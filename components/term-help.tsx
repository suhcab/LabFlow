'use client';
import { CircleHelp } from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
} from '@/components/ui/popover';
const explanations: Record<string, { description: string; example: string }> = {
  '장비 분해능 d': {
    description:
      '장비가 구별해 표시할 수 있는 가장 작은 간격입니다. 측정값과 같은 단위로 입력하세요. 이 앱은 반올림 오차 ±d/2를 균등분포로 가정해 uB=d/√12를 계산합니다.',
    example:
      '0.01 s 단위 초시계로 주기를 s 단위로 기록하면 d=0.01. 1 mm 눈금자를 m 단위로 기록하면 d=0.001. 0은 장비 오차가 없다는 뜻이 아니라 이 성분을 계산에 넣지 않았다는 뜻입니다.',
  },
  '포함인자 k': {
    description:
      '합성 표준불확도 uc를 몇 배로 넓힐지 정하는 수입니다. 확장불확도 U=k×uc이며 k는 단위가 없습니다. 수업·실험 지침의 값을 따르세요.',
    example:
      'uc=0.02 s, k=2이면 U=0.04 s입니다. k=2가 언제나 95%를 뜻하지는 않습니다. 정규분포 등 조건과 표본 수를 함께 고려해야 합니다.',
  },
  '표본 표준편차 s': {
    description:
      '반복 측정값 자체가 평균 주변에 얼마나 흩어져 있는지 나타냅니다. 평균의 불확도와 구별하세요.',
    example: '1.40, 1.42, 1.44 s의 표본 표준편차는 s=0.02 s입니다.',
  },
  '평균 표준불확도 uA': {
    description:
      '반복값의 통계로 평가한 평균의 표준불확도입니다. 동일 조건의 독립 반복값에서 uA=s/√n을 사용합니다.',
    example:
      's=0.02 s, 유효 반복 n=4이면 uA=0.01 s. 한 번만 측정하면 표본 s와 uA를 평가할 수 없습니다.',
  },
  '분해능 성분 uB': {
    description:
      '장비 분해능에서 평가한 B형 표준불확도 성분입니다. 이 앱은 d/√12를 사용하며 교정·환경 등 다른 B형 성분은 자동으로 포함하지 않습니다.',
    example: 'd=0.01 s이면 uB≈0.00289 s입니다.',
  },
  '합성 표준불확도 uc': {
    description:
      '이 앱에서는 독립으로 가정한 uA와 분해능 성분 uB를 제곱합의 제곱근으로 합칩니다: uc=√(uA²+uB²).',
    example:
      'uA=0.03 s, uB=0.04 s이면 uc=0.05 s. 상관이나 추가 오차 요인이 있으면 별도 평가가 필요합니다.',
  },
  '확장불확도 U': {
    description:
      '합성 표준불확도에 포함인자 k를 곱한 값입니다. 결과는 보통 평균 ± U와 k를 함께 보고합니다.',
    example:
      '평균 1.42 s, uc=0.02 s, k=2라면 1.42 ± 0.04 s (k=2)로 표시합니다.',
  },
};
export function TermHelp({ term }: { term: string }) {
  const help = explanations[term];
  if (!help) return null;
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={`${term} 설명 보기`}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
      >
        <CircleHelp className="size-4" />
      </PopoverTrigger>
      <PopoverContent
        className="w-80 max-w-[calc(100vw-2rem)] p-4"
        align="start"
      >
        <PopoverTitle>{term}</PopoverTitle>
        <PopoverDescription>{help.description}</PopoverDescription>
        <p className="rounded bg-muted p-3 text-sm">예시: {help.example}</p>
        <a
          className="text-xs underline"
          href="https://physics.nist.gov/cuu/Uncertainty/"
          target="_blank"
          rel="noreferrer"
        >
          불확도 안내 근거 · NIST
        </a>
      </PopoverContent>
    </Popover>
  );
}
