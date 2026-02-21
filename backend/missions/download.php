<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

// CORS headers (without JSON content-type — we'll set it per response)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$pdo = getDB();
requireAuth($pdo);

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if (!$id) {
    header('Content-Type: application/json');
    http_response_code(400);
    echo json_encode(['error' => 'Mission ID required']);
    exit();
}

$stmt = $pdo->prepare('SELECT * FROM missions WHERE id = ?');
$stmt->execute([$id]);
$mission = $stmt->fetch();

if (!$mission) {
    header('Content-Type: application/json');
    http_response_code(404);
    echo json_encode(['error' => 'Mission not found']);
    exit();
}

if (!class_exists('ZipArchive')) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['error' => 'ZIP support not available on this server']);
    exit();
}

$missionData = json_decode($mission['data'], true);
if (!$missionData) {
    $missionData = ['boxes' => [], 'connections' => []];
}

// Base path to uploaded files on the filesystem
$uploadBase = __DIR__ . '/../uploads';

// Sanitise title for use as a folder / filename
$safeTitle = preg_replace('/[^a-zA-Z0-9_\- ]/', '', $mission['title']);
$safeTitle = trim(preg_replace('/\s+/', '_', $safeTitle)) ?: 'mission';
$safeTitle = substr($safeTitle, 0, 80);

// -----------------------------------------------------------------------
// Walk every box and rewrite absolute API URLs to ZIP-relative paths.
// Collect the set of files that need to be included in the archive.
// -----------------------------------------------------------------------
// URL prefix patterns  →  ZIP sub-folder  →  filesystem sub-folder
$mediaTypes = [
    '/api/uploads/images/' => ['zip' => 'images/', 'fs' => $uploadBase . '/images/'],
    '/api/uploads/audio/'  => ['zip' => 'audio/',  'fs' => $uploadBase . '/audio/'],
];

$filesToAdd = []; // zipPath => filesystemPath

function rewriteUrl($url, $mediaTypes, &$filesToAdd) {
    if (!$url) return $url;
    foreach ($mediaTypes as $prefix => $info) {
        if (strpos($url, $prefix) === 0) {
            $filename = basename($url);
            $zipPath  = $info['zip'] . $filename;
            $fsPath   = $info['fs']  . $filename;
            if (file_exists($fsPath)) {
                $filesToAdd[$zipPath] = $fsPath;
            }
            return $zipPath;
        }
    }
    return $url; // external / unknown URL — keep as-is
}

foreach ($missionData['boxes'] as &$box) {
    if (!empty($box['image'])) {
        $box['image'] = rewriteUrl($box['image'], $mediaTypes, $filesToAdd);
    }
    if (!empty($box['audio'])) {
        $box['audio'] = rewriteUrl($box['audio'], $mediaTypes, $filesToAdd);
    }
    if (!empty($box['extendedAudio'])) {
        $box['extendedAudio'] = rewriteUrl($box['extendedAudio'], $mediaTypes, $filesToAdd);
    }
}
unset($box);

// Rewrite mission-level background audio URL
if (!empty($missionData['backgroundAudio'])) {
    $missionData['backgroundAudio'] = rewriteUrl($missionData['backgroundAudio'], $mediaTypes, $filesToAdd);
}

// -----------------------------------------------------------------------
// Build the export JSON
// -----------------------------------------------------------------------
$exportPayload = [
    'id'          => (int)$mission['id'],
    'title'       => $mission['title'],
    'description' => $mission['description'],
    'created_at'  => $mission['created_at'],
    'updated_at'  => $mission['updated_at'],
    'data'        => $missionData,
];

$missionJson = json_encode($exportPayload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

// -----------------------------------------------------------------------
// Create the ZIP in a temporary file
// -----------------------------------------------------------------------
$tmpFile = tempnam(sys_get_temp_dir(), 'mission_zip_');

$zip = new ZipArchive();
if ($zip->open($tmpFile, ZipArchive::OVERWRITE) !== true) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['error' => 'Failed to create ZIP archive']);
    exit();
}

// Add mission.json at the root of the ZIP
$zip->addFromString($safeTitle . '/mission.json', $missionJson);

// Add each media file under its sub-folder
foreach ($filesToAdd as $zipPath => $fsPath) {
    $zip->addFile($fsPath, $safeTitle . '/' . $zipPath);
}

$zip->close();

// -----------------------------------------------------------------------
// Stream the ZIP to the browser
// -----------------------------------------------------------------------
$zipFilename = $safeTitle . '.zip';
$fileSize    = filesize($tmpFile);

header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="' . $zipFilename . '"');
header('Content-Length: ' . $fileSize);
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

readfile($tmpFile);
unlink($tmpFile);
exit();
