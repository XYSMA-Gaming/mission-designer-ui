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
requireAuth($pdo);

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $errCode = isset($_FILES['file']) ? $_FILES['file']['error'] : -1;
    http_response_code(400);
    echo json_encode(['error' => 'No file uploaded or upload error (code: ' . $errCode . ')']);
    exit();
}

$file = $_FILES['file'];
$allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/webm', 'audio/x-wav', 'audio/x-m4a'];

// Also accept by extension for browsers that report generic types
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$allowedExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm', 'flac'];

if (!in_array($file['type'], $allowedTypes) && !in_array($ext, $allowedExts)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid file type. Allowed: mp3, wav, ogg, m4a, aac, webm, flac']);
    exit();
}

$maxSize = 50 * 1024 * 1024; // 50 MB
if ($file['size'] > $maxSize) {
    http_response_code(400);
    echo json_encode(['error' => 'File too large (max 50 MB)']);
    exit();
}

$uploadDir = __DIR__ . '/../uploads/audio/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$filename = bin2hex(random_bytes(16)) . '.' . $ext;
$dest     = $uploadDir . $filename;

if (!move_uploaded_file($file['tmp_name'], $dest)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save file']);
    exit();
}

echo json_encode([
    'url'  => '/api/uploads/audio/' . $filename,
    'name' => $file['name'],
]);
