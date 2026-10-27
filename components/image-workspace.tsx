'use client';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { downloadText } from '@/lib/research';
import {
  analyzeRegion,
  calibratedLength,
  compareRegions,
  IMAGE_METHOD,
  pixelDistance,
  regionBetween,
  type ImageAnalysisRecord,
  type Point,
  type Region,
  type RegionStats,
} from '@/lib/image-analysis';

type Pair = [Point, Point];
type Mode = 'a' | 'b' | 'scale' | 'measure';
type Photo = {
  filename: string;
  sha256: string;
  width: number;
  height: number;
  data: ImageData;
  bitmap: ImageBitmap;
};
const modes: { id: Mode; label: string }[] = [
  { id: 'a', label: '영역 A' },
  { id: 'b', label: '영역 B' },
  { id: 'scale', label: '기준 길이' },
  { id: 'measure', label: '측정 길이' },
];
const number = (value: number | null) =>
  value === null
    ? '미설정'
    : new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 4 }).format(
        value,
      );

export function ImageWorkspace({
  records,
  dirty,
  saving,
  onDirty,
  onSave,
}: {
  records: ImageAnalysisRecord[];
  dirty: boolean;
  saving: boolean;
  onDirty: (value: boolean) => void;
  onSave: (record: ImageAnalysisRecord) => Promise<boolean>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const bitmap = useRef<ImageBitmap | null>(null);
  const generation = useRef(0);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<Mode>('a');
  const [pending, setPending] = useState<Point | null>(null);
  const [a, setA] = useState<Region | null>(null);
  const [b, setB] = useState<Region | null>(null);
  const [scale, setScale] = useState<Pair | null>(null);
  const [measure, setMeasure] = useState<Pair | null>(null);
  const [known, setKnown] = useState('');
  const [unit, setUnit] = useState('mm');
  const [threshold, setThreshold] = useState(128);
  const [stats, setStats] = useState<{
    a: RegionStats;
    b: RegionStats | null;
  } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [coordinates, setCoordinates] = useState(['0', '0', '100', '100']);
  useEffect(
    () => () => {
      generation.current++;
      bitmap.current?.close();
    },
    [],
  );
  useEffect(() => {
    const el = canvas.current;
    if (!el || !photo) return;
    el.width = photo.width;
    el.height = photo.height;
    const context = el.getContext('2d');
    if (!context) return;
    context.drawImage(photo.bitmap, 0, 0);
    context.lineWidth = Math.max(photo.width, photo.height) / 250;
    for (const [region, color] of [
      [a, '#00bcd4'],
      [b, '#f97316'],
    ] as const)
      if (region) {
        context.strokeStyle = color;
        context.strokeRect(region.x, region.y, region.width, region.height);
      }
    for (const [pair, color] of [
      [scale, '#22c55e'],
      [measure, '#d946ef'],
    ] as const)
      if (pair) {
        context.strokeStyle = color;
        context.beginPath();
        context.moveTo(pair[0].x, pair[0].y);
        context.lineTo(pair[1].x, pair[1].y);
        context.stroke();
      }
    if (pending) {
      context.fillStyle = '#f43f5e';
      context.beginPath();
      context.arc(
        pending.x,
        pending.y,
        Math.max(photo.width, photo.height) / 100,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }, [photo, a, b, scale, measure, pending]);
  function changed() {
    setStats(null);
    setMessage('');
    onDirty(true);
  }
  async function load(file: File) {
    if (dirty) {
      setMessage('현재 분석을 저장하거나 편집 취소한 뒤 다른 사진을 여세요.');
      return;
    }
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 15 * 1024 * 1024
    ) {
      setMessage('15MB 이하의 PNG·JPEG·WebP 사진을 선택하세요.');
      return;
    }
    const ticket = ++generation.current;
    setLoading(true);
    setMessage('');
    let decoded: ImageBitmap | null = null;
    try {
      decoded = await createImageBitmap(file);
      if (decoded.width * decoded.height > 16_000_000)
        throw new Error(
          '사진은 1,600만 픽셀 이하여야 합니다. 원본의 복사본을 줄여서 사용하세요.',
        );
      const buffer = document.createElement('canvas');
      buffer.width = decoded.width;
      buffer.height = decoded.height;
      const ctx = buffer.getContext('2d', { willReadFrequently: true });
      if (!ctx)
        throw new Error('이 브라우저에서 이미지 분석을 지원하지 않습니다.');
      ctx.drawImage(decoded, 0, 0);
      const data = ctx.getImageData(0, 0, decoded.width, decoded.height);
      const digest = await crypto.subtle.digest(
        'SHA-256',
        await file.arrayBuffer(),
      );
      const sha256 = Array.from(new Uint8Array(digest), (value) =>
        value.toString(16).padStart(2, '0'),
      ).join('');
      if (ticket !== generation.current) {
        decoded.close();
        return;
      }
      bitmap.current?.close();
      bitmap.current = decoded;
      setPhoto({
        filename: file.name,
        sha256,
        width: decoded.width,
        height: decoded.height,
        data,
        bitmap: decoded,
      });
      setTitle(file.name.replace(/\.[^.]+$/, ''));
      setNotes('');
      setA({ x: 0, y: 0, width: decoded.width, height: decoded.height });
      setB(null);
      setScale(null);
      setMeasure(null);
      setPending(null);
      setKnown('');
      setThreshold(128);
      setStats(null);
      onDirty(true);
    } catch (error) {
      decoded?.close();
      if (ticket === generation.current)
        setMessage(
          error instanceof Error
            ? error.message
            : '사진을 읽지 못했습니다. 파일 형식을 확인하세요.',
        );
    } finally {
      if (ticket === generation.current) setLoading(false);
    }
  }
  function applyPoints(first: Point, last: Point) {
    if (!photo) return;
    if (
      ![first.x, first.y, last.x, last.y].every(Number.isFinite) ||
      [first, last].some(
        (point) =>
          point.x < 0 ||
          point.y < 0 ||
          point.x > photo.width ||
          point.y > photo.height,
      )
    ) {
      setMessage('좌표는 사진 범위 안의 유한한 숫자여야 합니다.');
      return;
    }
    if (mode === 'a' || mode === 'b') {
      const region = regionBetween(first, last, photo.width, photo.height);
      if (!region.width || !region.height) {
        setMessage('영역의 너비와 높이가 모두 1픽셀 이상이어야 합니다.');
        return;
      }
      if (mode === 'a') setA(region);
      else setB(region);
    } else {
      if (pixelDistance(first, last) < 1) {
        setMessage('길이를 정하는 두 점은 1픽셀 이상 떨어져야 합니다.');
        return;
      }
      if (mode === 'scale') setScale([first, last]);
      else setMeasure([first, last]);
    }
    changed();
    setPending(null);
  }
  function pick(event: MouseEvent<HTMLButtonElement>) {
    if (!photo || saving) return;
    if (event.detail === 0) {
      setMessage('키보드로는 아래 좌표 입력과 좌표 적용 버튼을 이용하세요.');
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = {
      x: Math.max(
        0,
        Math.min(
          photo.width,
          ((event.clientX - bounds.left) / bounds.width) * photo.width,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          photo.height,
          ((event.clientY - bounds.top) / bounds.height) * photo.height,
        ),
      ),
    };
    if (!pending) {
      setPending(point);
      setMessage('두 번째 점을 선택하세요.');
    } else applyPoints(pending, point);
  }
  function analyze() {
    if (!photo || !a) return;
    setBusy(true);
    setMessage('');
    // Yield once so the busy state paints before a large pixel loop.
    window.setTimeout(() => {
      try {
        setStats({
          a: analyzeRegion(
            photo.data.data,
            photo.width,
            photo.height,
            a,
            threshold,
          ),
          b: b
            ? analyzeRegion(
                photo.data.data,
                photo.width,
                photo.height,
                b,
                threshold,
              )
            : null,
        });
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : '영역 분석에 실패했습니다.',
        );
      } finally {
        setBusy(false);
      }
    }, 0);
  }
  const measuredPixels = measure ? pixelDistance(...measure) : null;
  const referencePixels = scale ? pixelDistance(...scale) : null;
  const length =
    measuredPixels !== null && referencePixels !== null
      ? calibratedLength(measuredPixels, referencePixels, Number(known))
      : null;
  function makeRecord(): ImageAnalysisRecord | null {
    if (!photo || !stats || !title.trim()) {
      setMessage('분석 제목을 입력하고 영역 수치 계산을 실행하세요.');
      return null;
    }
    if (
      scale &&
      (!Number.isFinite(Number(known)) || Number(known) <= 0 || !unit.trim())
    ) {
      setMessage('기준 길이에 양수와 단위를 입력하세요.');
      return null;
    }
    return {
      id: crypto.randomUUID(),
      title: title.trim(),
      created_at: new Date().toISOString(),
      filename: photo.filename,
      sha256: photo.sha256,
      width: photo.width,
      height: photo.height,
      notes,
      a: stats.a,
      b: stats.b,
      calibration: scale
        ? { points: scale, length: Number(known), unit: unit.trim() }
        : null,
      measurement: measure
        ? {
            points: measure,
            pixels: pixelDistance(...measure),
            length,
            unit: length === null ? 'px' : unit.trim(),
          }
        : null,
      method: IMAGE_METHOD,
    };
  }
  function cancel() {
    generation.current++;
    bitmap.current?.close();
    bitmap.current = null;
    setPhoto(null);
    setStats(null);
    setPending(null);
    setLoading(false);
    setMessage('');
    onDirty(false);
  }
  function restore(record: ImageAnalysisRecord) {
    if (!photo || photo.sha256 !== record.sha256) {
      setMessage(
        '동일한 원본 파일을 먼저 열어야 좌표를 복원할 수 있습니다. 파일 SHA-256이 일치해야 합니다.',
      );
      return;
    }
    setTitle(record.title);
    setNotes(record.notes);
    setA(record.a.region);
    setB(record.b?.region ?? null);
    setThreshold(record.a.threshold);
    setScale(record.calibration?.points ?? null);
    setMeasure(record.measurement?.points ?? null);
    setKnown(record.calibration ? String(record.calibration.length) : '');
    setUnit(record.calibration?.unit ?? 'mm');
    setStats({ a: record.a, b: record.b });
    setPending(null);
    onDirty(true);
  }
  return (
    <section className="space-y-5">
      <div className="rounded-xl border bg-muted/40 p-5 text-sm space-y-2">
        <h3 className="font-semibold">
          실험 사진에서 측정 가능한 수치를 추출하세요
        </h3>
        <p>
          사진 원본은 서버로 전송하지 않습니다. 두 영역의 RGB·밝기·기준 이상
          면적을 비교하고, 같은 평면에 있는 기준 길이로 거리를 환산합니다. 사진
          속 사물 이름을 추측하는 AI 기능은 아닙니다.
        </p>
        <p>
          같은 조명·노출·화이트밸런스에서 촬영하세요. 색상 수치는 농도나 실제
          광량이 아니며, 밝기 기준은 물체·세포를 자동 식별하지 않습니다.
          원근·렌즈 왜곡과 측정 불확도는 자동 보정하지 않습니다.
        </p>
      </div>
      <label
        htmlFor="research-photo"
        className="grid gap-2 text-sm font-medium"
      >
        분석할 사진 (PNG·JPEG·WebP, 15MB·1,600만 픽셀 이하)
        <input
          id="research-photo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={loading || busy || saving}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void load(file);
          }}
        />
      </label>
      <output className="block text-sm" aria-live="polite">
        {loading ? '사진 읽는 중…' : message}
      </output>
      {photo && (
        <fieldset
          disabled={loading || saving || busy}
          className="space-y-5 min-w-0"
        >
          <div className="flex flex-wrap gap-3 text-sm">
            <span>
              {photo.filename} · {photo.width} × {photo.height} px
            </span>
            <Button size="sm" variant="outline" onClick={cancel}>
              편집 취소·사진 닫기
            </Button>
          </div>
          <label htmlFor="photo-title" className="grid gap-2 text-sm">
            분석 제목
            <Input
              id="photo-title"
              maxLength={120}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                onDirty(true);
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {modes.map((item) => (
              <Button
                key={item.id}
                variant={mode === item.id ? 'default' : 'outline'}
                onClick={() => {
                  setMode(item.id);
                  setPending(null);
                  setMessage(
                    '사진에서 시작점과 끝점을 차례로 선택하거나 좌표를 입력하세요.',
                  );
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            선택: {modes.find((item) => item.id === mode)?.label} · 사진에서 두
            점을 차례로 누르세요. 영역 A는 청록, B는 주황, 기준 길이는 초록,
            측정 길이는 자홍입니다. 처음에는 전체 사진이 영역 A입니다.
          </p>
          <button
            type="button"
            aria-label="사진에서 시작점과 끝점 선택"
            onClick={pick}
            className="block w-full cursor-crosshair overflow-hidden border bg-white p-0"
          >
            <canvas
              ref={canvas}
              className="block h-auto w-full"
              aria-label="분석 사진과 선택한 영역"
            />
          </button>
          <details className="rounded-xl border p-4 text-sm">
            <summary className="cursor-pointer font-medium">
              정밀 좌표 입력 (키보드 사용 가능)
            </summary>
            <p className="my-3">
              원본 사진 좌측 위가 (0, 0)입니다. 영역은 경계 좌표, 길이는 두 점의
              좌표를 입력하세요.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {['시작 X', '시작 Y', '끝 X', '끝 Y'].map((label, index) => (
                <label className="grid gap-2" key={label}>
                  {label}
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={coordinates[index]}
                    onChange={(event) =>
                      setCoordinates((current) =>
                        current.map((value, i) =>
                          i === index ? event.target.value : value,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => {
                if (coordinates.some((value) => !value.trim())) {
                  setMessage('네 좌표를 모두 입력하세요.');
                  return;
                }
                applyPoints(
                  { x: Number(coordinates[0]), y: Number(coordinates[1]) },
                  { x: Number(coordinates[2]), y: Number(coordinates[3]) },
                );
              }}
            >
              좌표 적용
            </Button>
          </details>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setA({ x: 0, y: 0, width: photo.width, height: photo.height });
                changed();
              }}
            >
              A를 전체 사진으로
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setB(null);
                setPending(null);
                changed();
              }}
            >
              B 해제
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setScale(null);
                setMeasure(null);
                setPending(null);
                changed();
              }}
            >
              길이 설정 초기화
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label htmlFor="photo-threshold" className="grid gap-2 text-sm">
              밝기 기준 (이상, 0–255)
              <Input
                id="photo-threshold"
                type="number"
                min="0"
                max="255"
                value={threshold}
                onChange={(event) => {
                  setThreshold(Number(event.target.value));
                  changed();
                }}
              />
            </label>
            <label htmlFor="photo-known" className="grid gap-2 text-sm">
              기준선의 실제 길이
              <Input
                id="photo-known"
                type="number"
                min="0"
                step="any"
                value={known}
                onChange={(event) => {
                  setKnown(event.target.value);
                  onDirty(true);
                }}
              />
            </label>
            <label htmlFor="photo-unit" className="grid gap-2 text-sm">
              길이 단위
              <Input
                id="photo-unit"
                maxLength={20}
                value={unit}
                onChange={(event) => {
                  setUnit(event.target.value);
                  onDirty(true);
                }}
              />
            </label>
          </div>
          <p className="rounded-lg bg-muted p-3 text-sm">
            기준선: {number(referencePixels)} px · 측정선:{' '}
            {number(measuredPixels)} px · 환산 길이: {number(length)}{' '}
            {length === null ? '(기준선·실제 길이 필요)' : unit}. 기준선과
            대상이 같은 평면·축척이어야 합니다.
          </p>
          <label htmlFor="photo-notes" className="grid gap-2 text-sm">
            촬영·실험 조건과 해석 메모
            <Textarea
              id="photo-notes"
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                onDirty(true);
              }}
              placeholder="조명, 노출, 촬영 거리, 시료 조건, 밝기 기준을 선택한 이유"
            />
          </label>
          <Button onClick={analyze}>영역 수치 계산</Button>
          {stats && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <RegionResult label="영역 A" result={stats.a} />
                {stats.b && <RegionResult label="영역 B" result={stats.b} />}
              </div>
              {stats.b && (
                <p className="rounded-xl border p-4 text-sm">
                  B − A 밝기 차이:{' '}
                  {number(
                    compareRegions(stats.a, stats.b).brightnessDifference,
                  )}{' '}
                  · A 대비{' '}
                  {number(compareRegions(stats.a, stats.b).relativePercent)}%
                  (A=0이면 비율 미정) · 기준 이상 면적 비율 차이:{' '}
                  {number(
                    compareRegions(stats.a, stats.b).areaPercentPointDifference,
                  )}
                  %p
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={!dirty || records.length >= 30}
                  onClick={() => {
                    const record = makeRecord();
                    if (record) void onSave(record);
                  }}
                >
                  분석 결과를 프로젝트에 저장
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const record = makeRecord();
                    if (record)
                      downloadText(
                        '사진분석.json',
                        JSON.stringify(record, null, 2),
                        'application/json;charset=utf-8',
                      );
                  }}
                >
                  현재 분석 JSON
                </Button>
              </div>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            저장에는 원본 파일명·SHA-256·선택 좌표·계산 수치·메모가 포함됩니다.
            사진 원본은 별도로 보관하세요. 프로젝트당 최대 30개 기록을 보관하며,
            원본 픽셀을 독립 반복 실험으로 취급하지 않습니다.
          </p>
        </fieldset>
      )}
      {busy && <output className="block">픽셀 분석 중…</output>}
      <section className="space-y-3">
        <h3 className="font-semibold">
          저장한 사진 분석 ({records.length}/30)
        </h3>
        {!records.length && (
          <p className="text-sm text-muted-foreground">
            사진을 열고 수치를 계산한 뒤 저장하면 여기에 표시됩니다.
          </p>
        )}
        {records.map((record) => (
          <details key={record.id} className="rounded-xl border p-4">
            <summary className="cursor-pointer font-medium">
              {record.title} ·{' '}
              {new Date(record.created_at).toLocaleString('ko-KR')}
            </summary>
            <div className="mt-4 space-y-3 text-sm">
              <p className="break-all">
                원본: {record.filename} ({record.width} × {record.height}) ·
                SHA-256: {record.sha256}
              </p>
              <p className="whitespace-pre-wrap">{record.notes}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <RegionResult label="영역 A" result={record.a} />
                {record.b && <RegionResult label="영역 B" result={record.b} />}
              </div>
              <p>
                측정 길이:{' '}
                {record.measurement
                  ? `${number(record.measurement.length ?? record.measurement.pixels)} ${record.measurement.unit}`
                  : '미기록'}{' '}
                · 사진 원본은 저장되지 않습니다.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadText(
                      '사진분석.json',
                      JSON.stringify(record, null, 2),
                      'application/json;charset=utf-8',
                    )
                  }
                >
                  저장 분석 JSON
                </Button>
                <Button
                  disabled={saving || busy || loading}
                  variant="outline"
                  onClick={() => restore(record)}
                >
                  동일 원본에 좌표 복원
                </Button>
              </div>
            </div>
          </details>
        ))}
      </section>
    </section>
  );
}
function RegionResult({
  label,
  result,
}: {
  label: string;
  result: RegionStats;
}) {
  const max = Math.max(1, ...result.histogram);
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2 text-sm">
      <h4 className="font-semibold">{label}</h4>
      <p>
        좌표 ({result.region.x}, {result.region.y}), {result.region.width} ×{' '}
        {result.region.height} px · {number(result.pixels)}픽셀
      </p>
      <p>
        평균 RGB: {number(result.mean.r)} / {number(result.mean.g)} /{' '}
        {number(result.mean.b)}
      </p>
      <p>평균 밝기 (0–255): {number(result.mean.brightness)}</p>
      <p>
        밝기 {result.threshold} 이상: {number(result.abovePercent)}% (
        {number(result.aboveThreshold)}픽셀)
      </p>
      <svg
        aria-label={`${label} 밝기 히스토그램: 0부터 255까지의 픽셀 빈도`}
        viewBox="0 0 256 70"
        className="h-24 w-full border-b"
      >
        {result.histogram.map((count, index) => (
          <rect
            key={index}
            x={index}
            y={70 - (count / max) * 68}
            width="1"
            height={(count / max) * 68}
            fill="currentColor"
            className="text-primary"
          />
        ))}
      </svg>
      <p className="flex justify-between text-xs text-muted-foreground">
        <span>어두움 0</span>
        <span>밝음 255</span>
      </p>
    </div>
  );
}
