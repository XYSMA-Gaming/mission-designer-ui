<?php
function requireAuth($pdo) {
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

    if (!preg_match('/^Bearer (.+)$/', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit();
    }

    $token = $matches[1];
    $stmt = $pdo->prepare(
        'SELECT t.token, u.id as user_id, u.username, u.email
         FROM tokens t
         JOIN users u ON t.user_id = u.id
         WHERE t.token = ?'
    );
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired token']);
        exit();
    }

    return $user;
}
