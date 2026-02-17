<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

$pdo = getDB();
requireAuth($pdo);

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if (!$id) {
    http_response_code(400);
    echo json_encode(['error' => 'Mission ID required']);
    exit();
}

try {
    $stmt = $pdo->prepare('SELECT * FROM missions WHERE id = ?');
    $stmt->execute([$id]);
    $mission = $stmt->fetch();

    if (!$mission) {
        http_response_code(404);
        echo json_encode(['error' => 'Mission not found']);
        exit();
    }

    $mission['id'] = (int)$mission['id'];
    $mission['data'] = json_decode($mission['data'], true);

    echo json_encode(['mission' => $mission]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}
