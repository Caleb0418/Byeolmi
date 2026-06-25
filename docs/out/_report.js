const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, AlignmentType, PageBreak, TableOfContents,
        HeadingLevel, BorderStyle } = require('docx');
const C = require('./_common');

const navyRun = (t, opts = {}) => new TextRun({ text: t, color: C.NAVY, ...opts });
const grnRun = (t, opts = {}) => new TextRun({ text: t, color: C.GREEN, ...opts });

const children = [];

// ───────── 표지 ─────────
children.push(
  new Paragraph({ spacing: { before: 2600 }, children: [] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
    children: [new TextRun({ text: 'BONGBONG · 도매 발주·정산 시스템', size: 22, bold: true, color: C.GREEN })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: '별미집 도매 발주·정산 시스템', size: 52, bold: true, color: C.NAVY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 },
    children: [new TextRun({ text: '프로젝트 현황 보고서', size: 40, bold: true, color: C.NAVY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
    children: [new TextRun({ text: '사장님께 드리는 도입 검토용 보고서', size: 22, color: C.GRAY })] }),
  new Paragraph({ spacing: { before: 1400 }, children: [] }),
  C.table([3120, 6240],
    ['항목', '내용'],
    [
      ['작성일', '2026년 6월 4일'],
      ['버전', 'v0.9 (시연용 MVP)'],
      ['문서 구분', '프로젝트 현황 보고서 (비개발자용)'],
      ['대상 독자', '별미집 사장님'],
      ['현재 상태', { t: '시연 가능 — 정식 운영 준비 단계', color: C.GREEN, bold: true }],
    ]),
  new Paragraph({ children: [new PageBreak()] }),
);

// ───────── 목차 ─────────
children.push(
  C.h1('목차'),
  C.p('아래 목차의 제목을 누르면 해당 위치로 이동합니다. (Word에서 열면 자동으로 쪽 번호가 채워집니다.)', { size: 18, color: C.GRAY }),
  new TableOfContents('목차', { hyperlink: true, headingStyleRange: '1-2' }),
  new Paragraph({ children: [new PageBreak()] }),
);

// ───────── 1. 한 장 요약 ─────────
children.push(
  C.h1('1. 한 장 요약'),
  C.p('별미집 도매 발주·정산 시스템은 거래처 발주를 자동으로 모으고, 수량별 도매 단가로 자동 계산한 뒤, 카카오 알림톡으로 정산 명세서를 보내는 웹 서비스입니다. 카카오톡·전화·수기로 흩어지던 주문 취합과 계산을 한 화면에서 처리합니다.', { after: 160 }),
  C.table([3120, 6240], ['구분', '한눈에 보기'], [
    [{ t: '무엇을 만들었나', bold: true }, '거래처 발주 자동 취합 + 수량별 단가 자동 계산 + 원클릭 정산 알림톡 + 매출·미수금 통계까지 갖춘 도매 전용 웹앱'],
    [{ t: '지금 어디까지', bold: true }, { t: '실제 데이터베이스로 동작하는 시연 가능한 단계입니다. 화면·계산·발주는 모두 정상 동작하며, 실제 카카오 알림톡 발송 연동만 남았습니다.', color: C.NAVY }],
    [{ t: '사장님이 결정할 것', bold: true }, '① 정식 도입 여부와 시점 ② 실제 계좌·상호·사업자정보 ③ 카카오 비즈니스 채널 준비 ④ 대시보드 접근을 허용할 사장님 카카오 계정'],
  ]),
  ...C.figure('D-01_dashboard.png', 600, '[그림 1] 사장님 관리자 대시보드 — 오늘의 주문·예상 매출·취합 내역이 한 화면에 모입니다. (현재 화면의 숫자·상호·계좌는 모두 샘플입니다.)'),
);

// ───────── 2. 왜 만들었나 ─────────
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  C.h1('2. 왜 만들었나'),
  C.p('기존에는 거래처 주문을 카카오톡·전화로 받아 사람이 직접 종이나 엑셀에 옮겨 적고, 수량별 단가를 일일이 계산해 정산 안내를 보냈습니다. 주문이 몰리면 누락·오타·계산 실수가 생기기 쉬웠습니다. 이 시스템은 그 과정을 자동화합니다.'),
  C.table([4680, 4680], ['기존 방식 (Before)', '이 시스템 (After)'], [
    ['카톡·전화 주문을 사람이 받아 옮겨 적음', { t: '거래처가 직접 발주서를 넣으면 자동으로 취합', color: C.GREEN }],
    ['수량별 단가를 매번 손으로 계산', { t: '수량 구간에 따라 단가가 자동 적용·합산', color: C.GREEN }],
    ['정산 안내를 일일이 작성·전송', { t: '한 번에 거래처별 정산 알림톡 발송(연동 후)', color: C.GREEN }],
    ['누가 얼마 미수인지 따로 관리', { t: '거래처별 누적·수금/미수금을 화면에서 관리', color: C.GREEN }],
    ['매출 흐름은 감으로 파악', { t: '월·주·일 매출과 품목 비중을 그래프로 확인', color: C.GREEN }],
  ]),
);

// ───────── 3. 무엇을 할 수 있나 ─────────
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  C.h1('3. 무엇을 할 수 있나'),
  C.p('핵심 기능을 사장님 입장에서 정리했습니다.'),
  C.bullet([new TextRun({ text: '발주 자동 취합: ', bold: true }), new TextRun('거래처가 휴대폰으로 넣은 발주가 약 3초마다 사장님 화면에 자동으로 모입니다. 전화 주문은 수기로 바로 추가할 수 있습니다.')]),
  C.bullet([new TextRun({ text: '수량별 단가 자동 계산: ', bold: true }), new TextRun('“10박스 이상 18,000원, 30박스 이상 15,000원”처럼 구간 단가를 설정해 두면 금액이 자동으로 계산·합산됩니다.')]),
  C.bullet([new TextRun({ text: '원클릭 정산 알림톡: ', bold: true }), new TextRun('발주를 승인하면 거래처별 정산 명세서를 알림톡으로 한 번에 보낼 수 있습니다. 보내기 전 미리보기로 내용을 확인합니다.')]),
  C.bullet([new TextRun({ text: '매출·통계: ', bold: true }), new TextRun('월·주·일 매출 추이, 품목별 판매 비중, 거래처별 누적과 수금/미수금을 그래프와 표로 봅니다.')]),
  C.bullet([new TextRun({ text: '품목·단가 관리: ', bold: true }), new TextRun('취급 품목과 수량별 도매 단가를 직접 추가·수정·삭제합니다.')]),
  ...C.figure('D-05_alimtalk_preview.png', 470, '[그림 2] 정산 알림톡 미리보기 — 거래처별 청구 내역과 입금 계좌가 자동으로 채워집니다.'),
  ...C.figure('D-06_analytics_charts.png', 560, '[그림 3] 분석 및 통계 — 매출 추이, 품목 비중, 거래처별 누적·미수금을 한곳에서 확인합니다.'),
  ...C.figure('D-08_product_pricing.png', 580, '[그림 4] 품목 및 단가 설정 — 수량 구간별 도매 단가를 설정하면 혜택이 미리보기로 표시됩니다.'),
);

// ───────── 4. 시스템 구성 ─────────
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  C.h1('4. 시스템 구성'),
  C.p('어려운 기술 없이, 정보가 흐르는 순서만 보시면 됩니다.'),
  C.table([2680, 320, 2680, 320, 2680],
    ['① 구매자 휴대폰', '', '② 사장님 화면', '', '③ 카카오 알림톡'],
    [[
      { t: '거래처가 발주서에서 품목·수량을 담아 전송', align: AlignmentType.CENTER },
      { t: '→', bold: true, align: AlignmentType.CENTER, color: C.GREEN },
      { t: '발주가 자동으로 모이고 승인·정산 처리', align: AlignmentType.CENTER },
      { t: '→', bold: true, align: AlignmentType.CENTER, color: C.GREEN },
      { t: '거래처에 명세서 링크 전송, 계좌로 입금', align: AlignmentType.CENTER },
    ]], C.GREEN),
  C.spacer(120),
  C.p('모든 정보는 안전한 클라우드 데이터베이스에 저장되며, PC·태블릿·휴대폰 어디서나 같은 화면을 봅니다.', { size: 20, color: C.GRAY }),
);

// ───────── 5. 지금 개발 단계 ─────────
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  C.h1('5. 지금 개발 단계'),
  C.p('전체 5단계 중 현재는 “시연” 위치입니다.'),
  C.table([1872, 1872, 1872, 1872, 1872],
    ['기획', '개발(MVP)', '시연 ◀ 현재', '베타', '정식 운영'],
    [[
      { t: '완료 ✅', align: AlignmentType.CENTER, color: C.GREEN, bold: true },
      { t: '완료 ✅', align: AlignmentType.CENTER, color: C.GREEN, bold: true },
      { t: '진행 중', align: AlignmentType.CENTER, color: 'FFFFFF', bold: true, fill: C.NAVY },
      { t: '예정', align: AlignmentType.CENTER, color: C.GRAY },
      { t: '예정', align: AlignmentType.CENTER, color: C.GRAY },
    ]]),
  C.spacer(120),
  C.h2('완료된 기능 체크리스트'),
  C.bullet('거래처 발주서(품목 선택 → 발주자 정보 → 최종 확인) 3단계 동작', { ref: 'checks' }),
  C.bullet('로그인 없이도 발주 가능(시연용)', { ref: 'checks' }),
  C.bullet('사장님 대시보드 실시간 취합·전화 주문 수기 추가·일괄 수정', { ref: 'checks' }),
  C.bullet('수량별 차등 단가 자동 계산 및 정산 금액 합산', { ref: 'checks' }),
  C.bullet('정산 알림톡 미리보기 및 거래처별 명세서 화면', { ref: 'checks' }),
  C.bullet('매출·품목 비중·거래처별 누적·수금/미수금 통계', { ref: 'checks' }),
  C.bullet('임시 목업(LocalStorage) → 실제 클라우드 데이터베이스 전환 완료', { ref: 'checks' }),
);

// ───────── 6. 정식 운영 전 준비물 (핵심) ─────────
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  C.h1('6. 정식 운영 전 준비물 ⭐'),
  C.p('정식으로 사용하려면 아래 준비가 필요합니다. 사장님이 직접 해주실 것과, 개발자가 처리할 것으로 나눴습니다.'),
  C.h2('6-1. 사장님이 직접 준비·결정해야 할 것'),
  C.table([520, 3200, 5640], ['#', '무엇을', '왜 / 누가'], [
    ['1', { t: '실제 입금 계좌·상호·사업자정보 확정', bold: true }, '지금 화면의 상호·예금주·계좌번호·사업자번호·주소는 모두 샘플(테스트)입니다. 실제 계좌·상호는 사장님이 [시스템 설정] 화면에서 직접 입력하시고, 푸터의 사업자 상세는 개발자가 반영합니다.'],
    ['2', { t: '카카오 비즈니스 채널·알림톡 템플릿 준비', bold: true }, '알림톡 발송은 사장님(사업자) 명의의 카카오 비즈니스 채널과 사전 승인된 템플릿이 있어야 가능합니다. 채널 개설·템플릿 신청은 사업자 명의가 필요합니다.'],
    ['3', { t: '사장님 카카오 계정(이메일) 알려주기', bold: true }, '정식 운영 시 그 계정만 대시보드에 접근할 수 있도록 등록합니다.'],
    ['4', { t: '도입 여부·시점 결정', bold: true }, '시연을 보신 뒤 정식 사용 여부와 시작 시점을 정해 주시면 됩니다.'],
  ]),
  C.spacer(120),
  C.h2('6-2. 개발자가 처리할 것 (기술 항목)'),
  C.table([520, 3200, 5640], ['#', '무엇을', '내용'], [
    ['1', { t: '대시보드 접근 제어 복원', bold: true }, '현재는 시연을 위해 누구나 열람·편집 가능합니다(임시). 정식 전환 시 프론트 플래그와 데이터베이스의 임시 개방 정책 8개를 원래대로 되돌려 사장님 계정만 접근하도록 복원합니다.'],
    ['2', { t: '카카오 알림톡 실발송 연동', bold: true }, '알림톡 발송 기능에 카카오/발송사 인증 키를 등록합니다. 미설정 상태에서는 알림톡만 발송되지 않을 뿐, 발주 자체는 정상입니다.'],
    ['3', { t: '구매자 연락처 암호화 적용', bold: true }, '현재 연락처가 평문으로 저장됩니다. 개인정보 보호를 위해 암호화 처리를 적용합니다.'],
    ['4', { t: '호스팅·도메인 배포', bold: true }, '실제 도메인 연결과 배포, 보안 설정을 마무리합니다.'],
  ]),
  C.spacer(120),
  C.callout([
    [new TextRun({ text: '한 줄 요약  ', bold: true, color: C.NAVY }), new TextRun({ text: '사장님은 ‘실제 계좌·상호 / 카카오 채널 / 사장님 계정 / 도입 결정’ 네 가지만 준비해 주시면, 나머지 기술 작업은 개발자가 처리합니다.', size: 21 })],
  ], C.SAMPLE, C.GREEN),
);

// ───────── 7. 한계와 주의 ─────────
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  C.h1('7. 한계와 주의'),
  C.bullet([new TextRun({ text: '실제 알림톡은 아직 발송되지 않습니다. ', bold: true }), new TextRun('카카오 채널·발송 설정이 끝나기 전까지는 미리보기까지만 동작합니다. (발주·정산 계산은 정상)')]),
  C.bullet([new TextRun({ text: '지금은 화면이 누구에게나 열려 있습니다. ', bold: true }), new TextRun('시연 편의를 위한 임시 개방 상태로, 도매 단가 등 민감 정보가 노출될 수 있습니다. 정식 전환 시 반드시 접근을 제한합니다.')]),
  C.bullet([new TextRun({ text: '상호·계좌·사업자정보는 모두 샘플입니다. ', bold: true }), new TextRun('실제 거래 전에 반드시 실제 값으로 교체해야 합니다.')]),
  C.bullet([new TextRun({ text: '연락처가 평문으로 저장됩니다. ', bold: true }), new TextRun('개인정보 보호를 위해 정식 운영 전 암호화 적용이 필요합니다.')]),
);

// ───────── 8. 앞으로의 계획 ─────────
children.push(
  C.h1('8. 앞으로의 계획'),
  C.table([1400, 3000, 4960], ['단계', '목표', '내용'], [
    [{ t: '시연', bold: true, color: C.NAVY }, '현재', '샘플 데이터로 기능 시연 및 사장님 검토'],
    [{ t: '베타', bold: true, color: C.NAVY }, '소수 거래처', '실제 계좌·채널 적용 후 일부 단골 거래처와 시범 운영'],
    [{ t: '정식 운영', bold: true, color: C.NAVY }, '전체', '접근 제어 복원·알림톡 연동·도메인 배포 완료 후 본격 사용'],
  ]),
);

// ───────── 9. 비용·운영 ─────────
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  C.h1('9. 비용·운영'),
  C.p('구체적인 금액은 추후 별도 산정 예정입니다. 다만 다음 항목에서 운영 비용이 발생할 수 있음을 미리 알려드립니다.', { after: 120 }),
  C.bullet('클라우드 데이터베이스·서버(Supabase 등): 사용량·요금제에 따라 비용 발생 가능'),
  C.bullet('카카오 알림톡 발송: 보통 건당 과금 (발송량에 비례)'),
  C.bullet('도메인·호스팅: 도메인 등록·연장 등 연간 비용 발생 가능'),
  C.p('※ 위 금액은 사용 규모가 정해진 뒤 구체적으로 산정해 별도 안내드리겠습니다.', { size: 19, color: C.GRAY }),
);

// ───────── 10. 결정 요청 ─────────
children.push(
  C.h1('10. 결정 요청'),
  C.p('아래 사항에 대해 사장님의 결정을 부탁드립니다.'),
  C.numItem('정식 도입 여부와 시작 시점'),
  C.numItem('우선순위(먼저 적용했으면 하는 기능이 있다면)'),
  C.numItem('실제 입금 계좌·상호·사업자정보 제공'),
  C.numItem('카카오 비즈니스 채널 준비 및 사장님 카카오 계정(이메일) 전달'),
);

// ───────── 부록 ─────────
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  C.h1('부록 A. 용어집'),
  C.table([2600, 6760], ['용어', '쉬운 풀이'], [
    ['알림톡', '카카오톡으로 발송되는 사업자용 안내 메시지(정산 명세서 안내 등).'],
    ['거래처', '물건을 도매로 받아가는 구매처(마트·식당·유통업체 등).'],
    ['차등 단가', '구매 수량 구간에 따라 다르게 적용되는 도매 단가.'],
    ['미수금', '거래처가 아직 입금하지 않은 금액.'],
    ['대시보드', '오늘의 주문·매출·취합 내역을 한눈에 보는 사장님 관리 화면.'],
    ['RLS(접근 제어)', '로그인한 사람의 권한에 따라 볼 수 있는 데이터를 제한하는 보안 장치.'],
    ['MVP', '핵심 기능만 먼저 만든 최소 동작 제품(시연·검증용).'],
  ]),
  C.spacer(160),
  C.h1('부록 B. 개발자용 기술 사실'),
  C.bullet('비로그인 발주는 전용 안전 함수(submit_anonymous_order RPC)로 처리.'),
  C.bullet('카카오 로그인 사장님 권한은 승인 이메일 화이트리스트(approved_owners)에만 부여.'),
  C.bullet('정산 명세서는 거래처명 파라미터(invoice?buyer=거래처명)로 거래처별 내역을 표시.'),
  C.bullet('임시 개방: 프론트 플래그(DEMO_OPEN_ACCESS) + 데이터베이스 임시 정책(TEMP_DEMO_* 8개). 정식 전환 시 모두 복원.'),
  C.bullet('알림톡 발송 함수(send-alimtalk)에 발송사 인증 키 미설정 — 발송만 보류, 발주는 정상.'),
);

const doc = new Document({
  creator: '별미집',
  title: '별미집 프로젝트 현황 보고서',
  styles: C.baseStyles(),
  numbering: C.numberingConfig(),
  sections: [{
    properties: C.pageProps(),
    headers: { default: C.makeHeader('별미집 프로젝트 현황 보고서') },
    footers: { default: C.makeFooter() },
    children,
  }],
});

const OUT = path.join(__dirname, '별미집_프로젝트_보고서.docx');
Packer.toBuffer(doc).then(buf => { fs.writeFileSync(OUT, buf); console.log('WROTE', OUT, buf.length, 'bytes'); });
