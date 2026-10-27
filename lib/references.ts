export type Reference = {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  venue: string;
  kind: '연구 논문' | '종설' | '기관 자료' | '조사 기사';
  fields: string[];
  keywords: string[];
  note: string;
  url: string;
  doi?: string;
};

// Bibliographic metadata verified against publisher/institution pages on 2026-10-27.
export const references: Reference[] = [
  {
    id: 'katz2006',
    title: 'Aerodynamics of Race Cars',
    authors: 'J. Katz',
    year: 2006,
    venue: 'Annual Review of Fluid Mechanics 38, 27–63',
    kind: '종설',
    fields: ['물리', '융합'],
    keywords: [
      '공기역학',
      '유체',
      '양력',
      '항력',
      '다운포스',
      '날개',
      'f1',
      '레이싱',
      'aerodynamic',
      'drag',
      'lift',
      'cfd',
    ],
    note: '레이스카의 공력 성능과 다운포스를 정리한 종설입니다. 차체 형상·공력 실험을 설계할 때 배경 자료로 활용하세요.',
    doi: '10.1146/annurev.fluid.38.050304.092016',
    url: 'https://doi.org/10.1146/annurev.fluid.38.050304.092016',
  },
  {
    id: 'robot2019',
    title: 'Learning agile and dynamic motor skills for legged robots',
    authors: 'J. Hwangbo et al.',
    year: 2019,
    venue: 'Science Robotics 4, eaau5872',
    kind: '연구 논문',
    fields: ['정보과학', '융합'],
    keywords: [
      '강화학습',
      '보행',
      '로봇',
      '시뮬레이션',
      '지형',
      'reinforcement learning',
      'locomotion',
      'robot',
      'sim-to-real',
    ],
    note: '시뮬레이션에서 학습한 보행 제어를 실제 로봇에 적용하는 연구입니다. 시뮬레이션 조건과 실제 환경 차이를 검토할 때 참고하세요.',
    doi: '10.1126/scirobotics.aau5872',
    url: 'https://doi.org/10.1126/scirobotics.aau5872',
  },
  {
    id: 'ligo2016',
    title: 'Observation of Gravitational Waves from a Binary Black Hole Merger',
    authors: 'B. P. Abbott et al.',
    year: 2016,
    venue: 'Physical Review Letters 116, 061102',
    kind: '연구 논문',
    fields: ['물리', '지구과학'],
    keywords: [
      '중력',
      '중력파',
      '블랙홀',
      '신호',
      'gravitational',
      'black hole',
    ],
    note: '중력파 관측과 신호 검증 절차를 살펴볼 수 있는 연구입니다.',
    doi: '10.1103/PhysRevLett.116.061102',
    url: 'https://doi.org/10.1103/PhysRevLett.116.061102',
  },
  {
    id: 'nasa-aero',
    title: 'Guide to Aerodynamics',
    authors: 'NASA Glenn Research Center',
    year: null,
    venue: 'NASA Beginner’s Guide to Aeronautics',
    kind: '기관 자료',
    fields: ['물리', '융합'],
    keywords: [
      '공기역학',
      '유체',
      '양력',
      '항력',
      '다운포스',
      '날개',
      'f1',
      'aerodynamic',
      'drag',
      'lift',
      'cfd',
    ],
    note: '양력·항력과 실험 변수의 기초를 정리한 입문 자료입니다. F1 차량의 구체적인 설계 근거는 후속 논문으로 확인하세요.',
    url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/learn-about-aerodynamics/',
  },
  {
    id: 'battery1976',
    title: 'Electrical Energy Storage and Intercalation Chemistry',
    authors: 'M. S. Whittingham',
    year: 1976,
    venue: 'Science 192, 1126–1127',
    kind: '연구 논문',
    fields: ['화학', '융합'],
    keywords: [
      '배터리',
      '전지',
      '리튬',
      '전극',
      '전기화학',
      'battery',
      'lithium',
      'electrode',
    ],
    note: '삽입 반응을 이용한 에너지 저장 연구의 초기 논문입니다.',
    doi: '10.1126/science.192.4244.1126',
    url: 'https://doi.org/10.1126/science.192.4244.1126',
  },
  {
    id: 'ozone1974',
    title:
      'Stratospheric sink for chlorofluoromethanes: chlorine atom-catalysed destruction of ozone',
    authors: 'M. J. Molina & F. S. Rowland',
    year: 1974,
    venue: 'Nature 249, 810–812',
    kind: '연구 논문',
    fields: ['화학', '지구과학'],
    keywords: [
      '오존',
      '프레온',
      '대기',
      '염소',
      '촉매',
      'ozone',
      'chlorine',
      'cfc',
    ],
    note: '대기 중 반응 경로와 오존 파괴 가설을 연결한 연구입니다.',
    doi: '10.1038/249810a0',
    url: 'https://doi.org/10.1038/249810a0',
  },
  {
    id: 'dna1953',
    title:
      'Molecular Structure of Nucleic Acids: A Structure for Deoxyribose Nucleic Acid',
    authors: 'J. D. Watson & F. H. C. Crick',
    year: 1953,
    venue: 'Nature 171, 737–738',
    kind: '연구 논문',
    fields: ['생명과학', '화학'],
    keywords: ['dna', '유전', '핵산', '이중나선', '분자구조', 'genetic'],
    note: 'DNA 구조 모델을 제안한 역사적 논문입니다. 현대 유전학의 세부 내용은 최신 연구로 보완하세요.',
    doi: '10.1038/171737a0',
    url: 'https://doi.org/10.1038/171737a0',
  },
  {
    id: 'crispr2012',
    title:
      'A Programmable Dual-RNA–Guided DNA Endonuclease in Adaptive Bacterial Immunity',
    authors: 'M. Jinek et al.',
    year: 2012,
    venue: 'Science 337, 816–821',
    kind: '연구 논문',
    fields: ['생명과학'],
    keywords: [
      'crispr',
      'cas9',
      '유전자 편집',
      '유전자편집',
      'rna',
      '유전체',
      'genome',
    ],
    note: 'RNA로 유도하는 DNA 절단 기작과 유전자 편집 원리를 다룬 연구입니다.',
    doi: '10.1126/science.1225829',
    url: 'https://doi.org/10.1126/science.1225829',
  },
  {
    id: 'alphafold2021',
    title: 'Highly accurate protein structure prediction with AlphaFold',
    authors: 'J. Jumper et al.',
    year: 2021,
    venue: 'Nature 596, 583–589',
    kind: '연구 논문',
    fields: ['생명과학', '정보과학', '융합'],
    keywords: [
      '단백질',
      '구조 예측',
      '알파폴드',
      'alphafold',
      'protein',
      '접힘',
    ],
    note: '단백질 구조 예측 모델과 검증을 다룬 연구입니다.',
    doi: '10.1038/s41586-021-03819-2',
    url: 'https://doi.org/10.1038/s41586-021-03819-2',
  },
  {
    id: 'climate1967',
    title:
      'Thermal Equilibrium of the Atmosphere with a Given Distribution of Relative Humidity',
    authors: 'S. Manabe & R. T. Wetherald',
    year: 1967,
    venue: 'Journal of the Atmospheric Sciences 24, 241–259',
    kind: '연구 논문',
    fields: ['지구과학'],
    keywords: [
      '기후',
      '온난화',
      '온실',
      '복사',
      '이산화탄소',
      'climate',
      'co2',
      'humidity',
    ],
    note: '복사·대류 모형으로 대기 열평형을 다룬 초기 기후 모형 연구입니다.',
    url: 'https://www.gfdl.noaa.gov/bibliography/related_files/sm6701.pdf',
  },
  {
    id: 'ipcc2023',
    title: 'Climate Change 2023: Synthesis Report',
    authors: 'IPCC',
    year: 2023,
    venue: 'Sixth Assessment Report',
    kind: '기관 자료',
    fields: ['지구과학', '융합'],
    keywords: [
      '기후',
      '온난화',
      '탄소',
      '배출',
      'climate',
      'warming',
      'carbon',
    ],
    note: '기후 연구의 종합적인 배경과 참고문헌을 찾을 수 있는 평가 보고서입니다.',
    url: 'https://www.ipcc.ch/report/sixth-assessment-report-cycle/2023/',
  },
  {
    id: 'deep2015',
    title: 'Deep learning',
    authors: 'Y. LeCun, Y. Bengio & G. Hinton',
    year: 2015,
    venue: 'Nature 521, 436–444',
    kind: '종설',
    fields: ['정보과학', '융합'],
    keywords: [
      '딥러닝',
      '신경망',
      '인공지능',
      '기계학습',
      'deep learning',
      'neural',
      'machine learning',
    ],
    note: '딥러닝의 주요 개념과 연구 흐름을 정리한 종설입니다.',
    doi: '10.1038/nature14539',
    url: 'https://doi.org/10.1038/nature14539',
  },
  {
    id: 'attention2017',
    title: 'Attention Is All You Need',
    authors: 'A. Vaswani et al.',
    year: 2017,
    venue: 'NeurIPS 2017 · arXiv:1706.03762',
    kind: '연구 논문',
    fields: ['정보과학'],
    keywords: [
      '트랜스포머',
      '어텐션',
      '자연어',
      '언어모델',
      'transformer',
      'attention',
      'llm',
      '번역',
    ],
    note: 'Transformer 구조를 제안한 논문입니다. 이후 모델과의 차이는 후속 논문에서 확인하세요.',
    url: 'https://arxiv.org/abs/1706.03762',
    doi: '10.48550/arXiv.1706.03762',
  },
  {
    id: 'bootstrap1979',
    title: 'Bootstrap Methods: Another Look at the Jackknife',
    authors: 'B. Efron',
    year: 1979,
    venue: 'The Annals of Statistics 7, 1–26',
    kind: '연구 논문',
    fields: ['수학', '정보과학', '융합'],
    keywords: [
      '통계',
      '표준오차',
      '부트스트랩',
      '재표집',
      'bootstrap',
      'statistics',
      '신뢰구간',
    ],
    note: '재표집으로 통계량의 변동을 추정하는 부트스트랩 방법의 기초 논문입니다. 앱의 현재 불확도 계산은 부트스트랩 방식이 아닙니다.',
    doi: '10.1214/aos/1176344552',
    url: 'https://doi.org/10.1214/aos/1176344552',
  },
  {
    id: 'nist1297',
    title:
      'Guidelines for Evaluating and Expressing the Uncertainty of NIST Measurement Results',
    authors: 'B. N. Taylor & C. E. Kuyatt',
    year: 1994,
    venue: 'NIST Technical Note 1297, 1994 edition',
    kind: '기관 자료',
    fields: ['공통'],
    keywords: [
      '불확도',
      '분해능',
      '교정',
      '측정',
      '단진자',
      '주기',
      '오차',
      'uncertainty',
      'measurement',
      'pendulum',
    ],
    note: '측정불확도의 평가·합성과 보고 방법을 확인하는 지침입니다.',
    url: 'https://nvlpubs.nist.gov/nistpubs/legacy/tn/nbstechnicalnote1297.pdf',
  },
  {
    id: 'baker2016',
    title: '1,500 scientists lift the lid on reproducibility',
    authors: 'M. Baker',
    year: 2016,
    venue: 'Nature 533, 452–454',
    kind: '조사 기사',
    fields: ['공통'],
    keywords: ['재현', '반복', '연구윤리', 'reproducibility', 'replication'],
    note: '연구 재현성에 관한 설문 기사입니다. 실험 방법을 검증하는 연구 논문과 구분해 읽으세요.',
    doi: '10.1038/533452a',
    url: 'https://doi.org/10.1038/533452a',
  },
];

const normalize = (text: string) =>
  text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
export function recommendReferences(field: string, text: string) {
  const query = normalize(text);
  return references
    .map((ref) => {
      const matches = ref.keywords.filter((keyword) => {
        const term = normalize(keyword);
        return /^[a-z0-9]+$/.test(term)
          ? query.split(/[^\p{L}\p{N}]+/u).includes(term)
          : query.includes(term);
      });
      const sameField = ref.fields.includes(field);
      const common = ref.fields.includes('공통');
      return {
        ref,
        matches,
        score: matches.length * 10 + (sameField ? 3 : 0) + (common ? 1 : 0),
        reason: matches.length
          ? `주제 키워드: ${matches.join(', ')}`
          : sameField
            ? `${field} 분야 입문·배경 자료`
            : common
              ? '분야 공통 연구 방법 자료'
              : '다른 분야의 배경 자료',
      };
    })
    .sort((a, b) => b.score - a.score || a.ref.id.localeCompare(b.ref.id));
}
export function citation(ref: Reference) {
  return `${ref.authors} (${ref.year ?? '연도 미표기'}). ${ref.title}. ${ref.venue}. ${ref.url}`;
}
export function appendCitation(source: string, ref: Reference) {
  return source.includes(ref.url)
    ? source
    : `${source.trim()}${source.trim() ? '\n\n' : ''}${citation(ref)}`;
}
export function bibtex(ref: Reference) {
  const safe = (value: string) => value.replace(/[{}\\]/g, ' ');
  return `@${ref.kind === '기관 자료' || ref.kind === '조사 기사' ? 'misc' : 'article'}{${ref.id},\n  title = {${safe(ref.title)}},\n  author = {${safe(ref.authors)}},\n${ref.year ? `  year = {${ref.year}},\n` : ''}  note = {${safe(ref.venue)}},\n  url = {${ref.url}}${ref.doi ? `,\n  doi = {${ref.doi}}` : ''}\n}`;
}
