<?php
// Simple JSON state endpoint (Option A - file persistence)
// GET  /api/state.php -> returns {version, updatedAt, data}
// POST /api/state.php -> expects JSON {version?, data} ; writes atomically; returns new {version, updatedAt}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$statePath = __DIR__ . '/../data/state.json';

// Ensure file exists
if (!file_exists($statePath)) {
  $init = [
    'version' => 1,
    'updatedAt' => gmdate('c'),
    'data' => null
  ];
  @file_put_contents($statePath, json_encode($init, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function read_state($path) {
  $raw = @file_get_contents($path);
  if ($raw === false) return null;
  $j = json_decode($raw, true);
  return is_array($j) ? $j : null;
}

function write_state_atomic($path, $payload) {
  $dir = dirname($path);
  $tmp = tempnam($dir, 'state_');
  $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  if (@file_put_contents($tmp, $json) === false) return false;
  // atomic replace
  return @rename($tmp, $path);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
  $state = read_state($statePath);
  if (!$state) {
    http_response_code(500);
    echo json_encode(['error' => 'No pude leer state.json'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  echo json_encode($state, JSON_UNESCAPED_UNICODE);
  exit;
}

if ($method === 'POST') {
  $input = file_get_contents('php://input');
  $body = json_decode($input, true);

  if (!is_array($body) || !array_key_exists('data', $body)) {
    http_response_code(400);
    echo json_encode(['error' => 'Body inválido. Esperado JSON { data: ... }'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  // Optional optimistic concurrency:
  // Client can send expectedVersion; if mismatch, return 409
  $expected = null;
  if (array_key_exists('expectedVersion', $body)) $expected = intval($body['expectedVersion']);

  // Lock while reading/writing
  $fp = fopen($statePath, 'c+');
  if (!$fp) {
    http_response_code(500);
    echo json_encode(['error' => 'No pude abrir state.json'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  if (!flock($fp, LOCK_EX)) {
    fclose($fp);
    http_response_code(500);
    echo json_encode(['error' => 'No pude bloquear state.json'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  // Read current
  $raw = stream_get_contents($fp);
  $current = json_decode($raw ?: '', true);
  if (!is_array($current)) $current = ['version' => 1, 'updatedAt' => gmdate('c'), 'data' => null];

  if ($expected !== null && intval($current['version'] ?? 1) !== $expected) {
    flock($fp, LOCK_UN);
    fclose($fp);
    http_response_code(409);
    echo json_encode([
      'error' => 'conflict',
      'message' => 'Otro usuario guardó antes. Recargá y probá de nuevo.',
      'current' => $current
    ], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $nextVersion = intval($current['version'] ?? 1) + 1;
  $newState = [
    'version' => $nextVersion,
    'updatedAt' => gmdate('c'),
    'data' => $body['data']
  ];

  // Truncate + write
  ftruncate($fp, 0);
  rewind($fp);
  fwrite($fp, json_encode($newState, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
  fflush($fp);

  flock($fp, LOCK_UN);
  fclose($fp);

  echo json_encode($newState, JSON_UNESCAPED_UNICODE);
  exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
