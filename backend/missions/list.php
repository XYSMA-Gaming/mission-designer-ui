<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

$pdo = getDB();
requireAuth($pdo);

try {
    $stmt = $pdo->prepare(
        'SELECT id, title, description, created_at, updated_at
         FROM missions
         ORDER BY updated_at DESC'
    );
    $stmt->execute();
    $missions = $stmt->fetchAll();

    foreach ($missions as &$m) {
        $m['id'] = (int)$m['id'];
    }

    echo json_encode(['missions' => $missions]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}
