'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { downloadText } from '@/lib/research';
import {
  bibtex,
  citation,
  recommendReferences,
  references,
  type Reference,
} from '@/lib/references';

export function ReferenceLibrary({
  field,
  context,
  source,
  saving,
  onAdd,
}: {
  field: string;
  context: string;
  source: string;
  saving: boolean;
  onAdd: (ref: Reference) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('추천');
  const [savedOnly, setSavedOnly] = useState(false);
  const [copied, setCopied] = useState('');
  const ranked = recommendReferences(field, `${context} ${query}`);
  const saved = references.filter((ref) => source.includes(ref.url));
  const terms = query
    .normalize('NFKC')
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const visible = ranked.filter(({ ref, score }) => {
    if (savedOnly && !source.includes(ref.url)) return false;
    if (
      category !== '추천' &&
      category !== '전체' &&
      !ref.fields.includes(category)
    )
      return false;
    if (category === '추천' && !query.trim() && !savedOnly && score === 0)
      return false;
    const haystack = [
      ref.title,
      ref.authors,
      ref.note,
      ...ref.fields,
      ...ref.keywords,
    ]
      .join(' ')
      .normalize('NFKC')
      .toLocaleLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
  const externalQuery = query.trim() || context.slice(0, 180);
  async function copy(ref: Reference) {
    try {
      await navigator.clipboard.writeText(citation(ref));
      setCopied(`${ref.title} 인용문을 복사했습니다.`);
    } catch {
      setCopied(
        '복사 권한이 없습니다. 카드의 인용문을 선택하거나 TXT로 내려받으세요.',
      );
    }
  }
  return (
    <section className="space-y-5">
      <div className="rounded-xl border bg-muted/40 p-5 space-y-2">
        <h3 className="font-semibold">분야 + 주제 키워드로 찾는 연구 출발점</h3>
        <p className="text-sm text-muted-foreground">
          검증한 대표 문헌 {references.length}개를 프로젝트명·주제·연구
          질문·변수와 비교합니다. 키워드 일치를 분야 일치보다 우선하며 추천
          이유를 표시합니다. 최신 논문 전체 검색이나 AI의 내용 검증 결과는
          아닙니다.
        </p>
        <p className="text-sm text-muted-foreground">
          원문을 읽고 연구에 적합한지 확인한 뒤 저장하세요. 일부 원문은 유료일
          수 있습니다. 서지 정보 확인: 2026-10-27.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="grid gap-2 text-sm" htmlFor="reference-query">
          문헌 검색 · 한국어 또는 영어 키워드
          <Input
            id="reference-query"
            placeholder="예: 공기역학, 단백질, transformer"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm" htmlFor="reference-field">
          분야
          <select
            id="reference-field"
            className="rounded-md border bg-background px-3 py-2"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {[
              '추천',
              '전체',
              '물리',
              '화학',
              '생명과학',
              '지구과학',
              '정보과학',
              '수학',
              '융합',
              '공통',
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={savedOnly}
            onChange={(event) => setSavedOnly(event.target.checked)}
          />
          저장한 문헌만 ({saved.length})
        </label>
        <Button
          variant="outline"
          disabled={!saved.length}
          onClick={() =>
            downloadText(
              '참고문헌.txt',
              saved.map(citation).join('\n\n'),
              'text/plain;charset=utf-8',
            )
          }
        >
          저장 목록 TXT
        </Button>
        <Button
          variant="outline"
          disabled={!saved.length}
          onClick={() =>
            downloadText(
              '참고문헌.bib',
              saved.map(bibtex).join('\n\n'),
              'application/x-bibtex;charset=utf-8',
            )
          }
        >
          BibTeX
        </Button>
      </div>
      <div className="rounded-xl border p-4 text-sm space-y-2">
        <p>
          더 구체적이거나 최신인 논문은 검색어를 수정해 찾아보세요. 버튼을
          누르면 입력한 검색어(미입력 시 프로젝트 주제)가 외부 검색 사이트로
          전달됩니다.
        </p>
        <a
          className="inline-block font-medium text-primary underline"
          href={`https://scholar.google.com/scholar?q=${encodeURIComponent(externalQuery)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Scholar에서 후속 논문 찾기 ↗
        </a>
      </div>
      <output className="block text-sm" aria-live="polite">
        {copied ||
          `${visible.length}개 문헌 · 저장한 문헌은 연구 현황의 ‘원자료·참고 자료 출처’에도 기록됩니다.`}
      </output>
      {!visible.length && (
        <p className="rounded-xl border p-6">
          조건에 맞는 내장 문헌이 없습니다. 검색어·분야를 바꾸거나 외부 검색을
          이용하세요.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map(({ ref, reason }) => (
          <article
            key={ref.id}
            className="flex flex-col gap-3 rounded-xl border bg-card p-5"
          >
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{ref.kind}</span>
              <span>{ref.year ?? '연도 미표기'}</span>
              <span>{ref.fields.join(' · ')}</span>
            </div>
            <h3 className="font-semibold leading-snug">{ref.title}</h3>
            <p className="text-sm text-muted-foreground">
              {ref.authors} · {ref.venue}
            </p>
            <p className="text-sm">{ref.note}</p>
            <p className="rounded-lg bg-primary/5 p-2 text-xs">
              추천 근거: {reason}
            </p>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">인용문 보기</summary>
              <p className="mt-2 break-words select-text">{citation(ref)}</p>
            </details>
            <div className="mt-auto flex flex-wrap items-center gap-2">
              <a
                className="mr-auto text-sm font-medium text-primary underline"
                target="_blank"
                rel="noopener noreferrer"
                href={ref.url}
              >
                원문·서지 정보 ↗
              </a>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void copy(ref)}
              >
                인용 복사
              </Button>
              <Button
                size="sm"
                disabled={saving || source.includes(ref.url)}
                onClick={() => void onAdd(ref)}
              >
                {source.includes(ref.url) ? '저장됨' : '프로젝트에 저장'}
              </Button>
            </div>
          </article>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        저장한 문헌의 수정·제거는 연구 현황 → 원자료·참고 자료 출처에서 편집하고
        저장하세요. BibTeX는 간략 서지이며 et al.로 줄인 저자 정보는 최종 제출
        전 출판사 인용 정보로 보완하세요.
      </p>
    </section>
  );
}
