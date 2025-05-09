<?php
// DB 연결 부분 필요

$pdf_id = $_GET['pdf_id'] ?? null;

header('Content-Type: application/json');

if (!$pdf_id) {
    echo json_encode(['error' => 'pdf_id missing']);
    exit;
}

// TODO: 실제 DB 조회
// 예시 데이터 반환
echo json_encode([
    'pdfId' => $pdf_id,
    'pages' => [
        [
            'page' => 1,
            'actions' => [
                ['type' => 'text', 'color' => 'blue', 'position' => ['x' => 100, 'y' => 150], 'text' => '샘플 글씨'],
            ]
        ]
    ]
]);
