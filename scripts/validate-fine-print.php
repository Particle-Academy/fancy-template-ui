<?php

/**
 * Put every rendered golden through fine-print's own validator and writer.
 *
 *   php scripts/validate-fine-print.php <path to a fine-print checkout with vendor/>
 *
 * Exit 0 only when every document validates with no errors AND writes a PDF.
 * Run after `UPDATE_GOLDENS=1 npm test` changes tests/fixtures/rendered-goldens.json.
 */

declare(strict_types=1);

use FinePrint\Agent;

$root = $argv[1] ?? null;
if ($root === null || ! is_file($root.'/vendor/autoload.php')) {
    fwrite(STDERR, "usage: php scripts/validate-fine-print.php <fine-print checkout with vendor/>\n");
    exit(2);
}
require $root.'/vendor/autoload.php';

$goldens = json_decode((string) file_get_contents(__DIR__.'/../tests/fixtures/rendered-goldens.json'), true, 512, JSON_THROW_ON_ERROR);

// The instrument must be able to go red. Agent::validate returns a bare LIST of
// errors (not {ok, errors}); reading it the wrong way passes everything. So a
// known-invalid document goes through first, and must fail.
$control = Agent::validate(['blocks' => [['type' => 'paragraph', 'runs' => [['text' => 1]]]]]);
if (! is_array($control) || $control === []) {
    echo "FAIL the negative control validated: this check cannot detect anything\n";
    exit(1);
}
echo 'ok   negative control refused ('.count($control)." error(s))\n";

$failed = 0;
foreach ($goldens as $name => $doc) {
    $errors = Agent::validate($doc);
    if ($errors !== []) {
        $failed++;
        echo "FAIL {$name}: ".json_encode($errors, JSON_UNESCAPED_SLASHES)."\n";

        continue;
    }
    $bytes = Agent::toBytes($doc);
    if (! str_starts_with($bytes, '%PDF-')) {
        $failed++;
        echo "FAIL {$name}: toBytes did not produce a PDF\n";

        continue;
    }
    echo "ok   {$name}: ".strlen($bytes)." bytes\n";
}
echo $failed === 0 ? "ALL VALID\n" : "{$failed} FAILED\n";
exit($failed === 0 ? 0 : 1);
