<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$pdo = getDB();
$user = requireAuth($pdo);

$body = json_decode(file_get_contents('php://input'), true);
$id          = isset($body['id'])          ? (int)$body['id'] : null;
$title       = trim(isset($body['title'])       ? $body['title']       : '');
$description = trim(isset($body['description']) ? $body['description'] : '');
$data        = isset($body['data'])        ? $body['data']        : ['boxes' => [], 'connections' => []];

if (!$title) {
    http_response_code(400);
    echo json_encode(['error' => 'Mission title is required']);
    exit();
}

$dataJson = json_encode($data);

try {
    if ($id) {
        $stmt = $pdo->prepare(
            'UPDATE missions SET title = ?, description = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        );
        $stmt->execute([$title, $description, $dataJson, $id]);
        echo json_encode(['id' => $id, 'message' => 'Mission updated']);
    } else {
        $stmt = $pdo->prepare(
            'INSERT INTO missions (title, description, data, created_by) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$title, $description, $dataJson, $user['user_id']]);
        $newId = (int)$pdo->lastInsertId();
        echo json_encode(['id' => $newId, 'message' => 'Mission created']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}
