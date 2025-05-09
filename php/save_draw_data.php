<?php
// DB 연결 필요

$data = json_decode(file_get_contents('php://input'), true);

header('Content-Type: application/json');

if (!$data || !isset($data['pdfId'])) {
    echo json_encode(['success' => false, 'message' => '잘못된 요청']);
    exit;
}

// TODO: 실제 DB 저장 로직
file_put_contents(__DIR__ . '/saved_' . $data['pdfId'] . '.json', json_encode($data));

echo json_encode(['success' => true]);
