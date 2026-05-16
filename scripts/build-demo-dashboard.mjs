#!/usr/bin/env node
// Generate a self-contained demo dashboard for GitHub Pages.
//
// Writes synthetic JSONL transcripts to docs/demo-data/projects/, then runs
// the same buildIndex + renderDashboardHtml pipeline the CLI uses to emit
// docs/index.html. The output is a single HTML file with all CSS/JS/data
// inlined — fully interactive on a static host. No network calls.

import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const demoRoot = path.join(repoRoot, 'docs', 'demo-data');
const projectsRoot = path.join(demoRoot, 'projects');
const outHtml = path.join(repoRoot, 'docs', 'index.html');

// Redirect discovery before importing the renderer modules. Also isolate the
// index cache so the demo build doesn't prune the user's real-session cache.
process.env.CASTORY_PROJECTS_ROOT = projectsRoot;
process.env.CASTORY_CACHE_ROOT = path.join(demoRoot, '.cache');

// ---------- demo data ----------

// Fixed base date so rebuilds are byte-stable (no churn in git diffs).
const BASE = new Date('2026-05-16T18:00:00.000Z').getTime();
const min = (n) => n * 60_000;
const hr = (n) => n * 3_600_000;
const day = (n) => n * 86_400_000;

const projects = {
  castory: {
    cwd: '/Users/demo/coding-agent-story',
    encoded: '-Users-demo-coding-agent-story',
  },
  shop: {
    cwd: '/Users/demo/shop-api',
    encoded: '-Users-demo-shop-api',
  },
};

const sessions = [
  // --- 1) Short, no interventions, today ---
  {
    id: 'demo-add-filter-chip',
    project: 'castory',
    branch: 'feat/has-failures-filter',
    startOffsetMs: -hr(2), // ~2h ago from BASE
    model: 'claude-opus-4-7',
    turns: [
      {
        kind: 'user',
        text: "Add a 'has failures' filter chip to the dashboard toolbar — same UX as the existing 'has interventions' one.",
        dtMs: 0,
      },
      {
        kind: 'assistant',
        text: "I'll add a checkbox in the toolbar and wire it into the client-side filter pipeline because the dashboard renders entirely on the client.",
        dtMs: min(0.2),
        usage: { input: 4120, output: 84, cache_read: 11_200, cache_creation: 0 },
      },
      {
        kind: 'tool_use',
        tool: 'Read',
        input: { file_path: '/Users/demo/coding-agent-story/src/render/dashboard-html.js' },
        dtMs: min(0.3),
      },
      {
        kind: 'tool_result',
        ok: true,
        text: 'File contents…',
        dtMs: min(0.5),
      },
      {
        kind: 'assistant',
        text: "I see the existing 'has interventions' checkbox at the toolbar end. I'll mirror that exact pattern so the new chip slots in cleanly.",
        dtMs: min(0.7),
        usage: { input: 4180, output: 120, cache_read: 11_200, cache_creation: 0 },
      },
      {
        kind: 'tool_use',
        tool: 'Edit',
        input: {
          file_path: '/Users/demo/coding-agent-story/src/render/dashboard-html.js',
          old_string: '<label><input type="checkbox" id="coding-agent-story-hasint"> has interventions</label>',
          new_string:
            '<label><input type="checkbox" id="coding-agent-story-hasint"> has interventions</label>\n    <label><input type="checkbox" id="coding-agent-story-hasfail"> has failures</label>',
        },
        dtMs: min(1.0),
      },
      { kind: 'tool_result', ok: true, text: 'Edited successfully', dtMs: min(1.1) },
      {
        kind: 'tool_use',
        tool: 'Edit',
        input: {
          file_path: '/Users/demo/coding-agent-story/src/render/templates/dashboard.client.js',
          old_string: 'if (STATE.hasint && !s.intervention_count) return false;',
          new_string:
            'if (STATE.hasint && !s.intervention_count) return false;\n      if (STATE.hasfail && !s.tool_failures) return false;',
        },
        dtMs: min(1.6),
      },
      { kind: 'tool_result', ok: true, text: 'Edited successfully', dtMs: min(1.7) },
      {
        kind: 'tool_use',
        tool: 'Bash',
        input: { command: 'npm test --silent', description: 'Run unit tests' },
        dtMs: min(2.1),
      },
      { kind: 'tool_result', ok: true, text: '142 passing\n0 failing', dtMs: min(2.6) },
      {
        kind: 'assistant',
        text: 'Tests pass. The new chip is wired through the same filter pipeline as the rest.',
        dtMs: min(2.7),
        usage: { input: 4300, output: 32, cache_read: 11_400, cache_creation: 0 },
      },
      { kind: 'turn_duration', durationMs: 162_000, dtMs: min(2.8) },
    ],
  },

  // --- 2) Fork → intervention, yesterday, uses simplify skill ---
  {
    id: 'demo-share-atomic',
    project: 'castory',
    branch: 'fix/share-atomic',
    startOffsetMs: -day(1),
    model: 'claude-opus-4-7',
    turns: [
      {
        kind: 'user',
        text: 'The share command sometimes leaves the repo dirty if `git commit` fails mid-write. Make the whole operation atomic.',
        dtMs: 0,
      },
      {
        kind: 'assistant',
        text: 'Two options here: 1) write to a temp dir and atomically rename into `.coding-agent-story/sessions/`, or 2) wrap the whole operation in a single `git stash` + apply at the end. Which do you want?',
        dtMs: min(0.4),
        usage: { input: 5200, output: 96, cache_read: 12_000, cache_creation: 0 },
      },
      {
        kind: 'user',
        text: "go with option 1 — temp dir + atomic rename. don't use git stash, we burned on that last quarter when it ate uncommitted edits.",
        dtMs: min(1.6),
      },
      {
        kind: 'assistant',
        text: "I'll write to `.coding-agent-story/.tmp-<pid>/`, fsync, then rename to the final path so a crash mid-write can't leave a partial sessions/ dir.",
        dtMs: min(1.9),
        usage: { input: 5300, output: 124, cache_read: 12_100, cache_creation: 0 },
      },
      {
        kind: 'tool_use',
        tool: 'Skill',
        input: { skill: 'simplify', args: 'src/cmd/share.js' },
        dtMs: min(2.2),
      },
      { kind: 'tool_result', ok: true, text: '(skill applied)', dtMs: min(2.3) },
      {
        kind: 'tool_use',
        tool: 'Edit',
        input: {
          file_path: '/Users/demo/coding-agent-story/src/cmd/share.js',
          old_string: 'await writeFile(target, body);',
          new_string:
            "const tmp = path.join(repoRoot, '.coding-agent-story', `.tmp-${process.pid}`);\n  await mkdir(tmp, { recursive: true });\n  await writeFile(path.join(tmp, basename), body);\n  await rename(tmp, target);",
        },
        dtMs: min(4.0),
      },
      { kind: 'tool_result', ok: true, text: 'Edited successfully', dtMs: min(4.1) },
      {
        kind: 'tool_use',
        tool: 'Bash',
        input: { command: 'npm test -- share', description: 'Run share tests' },
        dtMs: min(4.4),
      },
      { kind: 'tool_result', ok: true, text: '12 passing\n0 failing', dtMs: min(5.0) },
      {
        kind: 'tool_use',
        tool: 'Bash',
        input: {
          command: 'node test/manual/share-crash-sim.js',
          description: 'Simulate crash mid-share and verify no partial state',
        },
        dtMs: min(5.2),
      },
      {
        kind: 'tool_result',
        ok: true,
        text: '✓ no partial files left after SIGKILL',
        dtMs: min(6.0),
      },
      {
        kind: 'assistant',
        text: 'Atomic rename verified — crash mid-share now leaves the repo clean. Going to commit.',
        dtMs: min(6.2),
        usage: { input: 5450, output: 38, cache_read: 12_200, cache_creation: 0 },
      },
      { kind: 'turn_duration', durationMs: 418_000, dtMs: min(6.3) },
    ],
  },

  // --- 3) Long diagnose, 2 interventions, subagent, /diagnose skill, 3 days ago ---
  {
    id: 'demo-checkout-flake',
    project: 'shop',
    branch: 'fix/checkout-flake',
    startOffsetMs: -day(3),
    model: 'claude-opus-4-7',
    turns: [
      {
        kind: 'user',
        text:
          '<command-name>diagnose</command-name>\n' +
          'The checkout integration test fails on CI roughly 1/4 runs but never locally. Help me find the actual cause.',
        dtMs: 0,
      },
      {
        kind: 'assistant',
        text: "I'll reproduce first by running the test 20x with --repeat. Because intermittent, we want a deterministic repro before guessing.",
        dtMs: min(0.5),
        usage: { input: 6800, output: 110, cache_read: 18_000, cache_creation: 0 },
      },
      {
        kind: 'tool_use',
        tool: 'Bash',
        input: {
          command: 'npm run test -- --grep "checkout flow" --repeat 20',
          description: 'Repeat the flaky test to reproduce',
        },
        dtMs: min(0.7),
      },
      {
        kind: 'tool_result',
        ok: false,
        text:
          'iter 1..13 passing\n' +
          'iter 14: AssertionError: expected order_id to be defined, got undefined\n' +
          'iter 15..20 passing',
        dtMs: min(3.4),
      },
      {
        kind: 'assistant',
        text: 'Got a repro on iteration 14. Hypothesis: race between `cart.clear()` and `order.create()` because the test sometimes observes an empty cart before the order row exists.',
        dtMs: min(3.6),
        usage: { input: 7100, output: 95, cache_read: 18_200, cache_creation: 0 },
      },
      {
        kind: 'tool_use',
        tool: 'Read',
        input: { file_path: '/Users/demo/shop-api/src/checkout/cart.js' },
        dtMs: min(3.8),
      },
      { kind: 'tool_result', ok: true, text: '(file contents)', dtMs: min(4.0) },
      {
        kind: 'assistant',
        text: "Found it — line 87 fires `analytics.trackClear()` without await. The Promise resolves *after* the test reads cart state. I'll await it.",
        dtMs: min(4.3),
        usage: { input: 7200, output: 88, cache_read: 18_400, cache_creation: 0 },
      },
      {
        kind: 'user',
        text:
          "wait — don't just patch that one Promise. find every spot in src/checkout/ that fires async work without awaiting. If one slipped through, others probably did too.",
        dtMs: min(5.0),
      },
      {
        kind: 'assistant',
        text: "Good catch — I'll spawn an Explore subagent to map every fire-and-forget async call in src/checkout/ before patching anything.",
        dtMs: min(5.3),
        usage: { input: 7350, output: 78, cache_read: 18_500, cache_creation: 0 },
      },
      {
        kind: 'tool_use',
        tool: 'Agent',
        input: {
          subagent_type: 'Explore',
          description: 'Map fire-and-forget async in checkout/',
          prompt: 'Find every spot in src/checkout/**/*.js that calls an async function without `await` or `.then`. Return file:line.',
        },
        dtMs: min(5.4),
      },
      {
        kind: 'tool_result',
        ok: true,
        text:
          'Found 4 fire-and-forget calls:\n' +
          '  src/checkout/cart.js:87   analytics.trackClear()\n' +
          '  src/checkout/payment.js:142 notifier.paymentSettled()\n' +
          '  src/checkout/order.js:55   audit.log({event:"order_created"})\n' +
          '  src/checkout/refund.js:30  analytics.trackRefund()',
        dtMs: min(7.8),
      },
      {
        kind: 'assistant',
        text: "Four spots. I'll await all four and add a regression test that asserts the cart is empty *only after* the order row exists.",
        dtMs: min(8.0),
        usage: { input: 8100, output: 130, cache_read: 19_000, cache_creation: 0 },
      },
      {
        kind: 'tool_use',
        tool: 'Edit',
        input: {
          file_path: '/Users/demo/shop-api/src/checkout/cart.js',
          old_string: 'analytics.trackClear();',
          new_string: 'await analytics.trackClear();',
        },
        dtMs: min(8.4),
      },
      { kind: 'tool_result', ok: true, text: 'Edited successfully', dtMs: min(8.5) },
      {
        kind: 'tool_use',
        tool: 'Edit',
        input: {
          file_path: '/Users/demo/shop-api/src/checkout/payment.js',
          old_string: 'notifier.paymentSettled(order);',
          new_string: 'await notifier.paymentSettled(order);',
        },
        dtMs: min(8.6),
      },
      { kind: 'tool_result', ok: true, text: 'Edited successfully', dtMs: min(8.7) },
      {
        kind: 'tool_use',
        tool: 'Edit',
        input: {
          file_path: '/Users/demo/shop-api/src/checkout/order.js',
          old_string: "audit.log({event:'order_created', id});",
          new_string: "await audit.log({event:'order_created', id});",
        },
        dtMs: min(8.8),
      },
      { kind: 'tool_result', ok: true, text: 'Edited successfully', dtMs: min(8.9) },
      {
        kind: 'tool_use',
        tool: 'Edit',
        input: {
          file_path: '/Users/demo/shop-api/src/checkout/refund.js',
          old_string: 'analytics.trackRefund(refundId);',
          new_string: 'await analytics.trackRefund(refundId);',
        },
        dtMs: min(9.0),
      },
      { kind: 'tool_result', ok: true, text: 'Edited successfully', dtMs: min(9.1) },
      {
        kind: 'tool_use',
        tool: 'Write',
        input: {
          file_path: '/Users/demo/shop-api/test/checkout/race.test.js',
          content:
            "import { test, expect } from 'vitest';\nimport { runCheckout } from '../../src/checkout/index.js';\n\ntest('cart clear waits for order_id', async () => {\n  const result = await runCheckout(fixtures.basic);\n  expect(result.order_id).toBeDefined();\n  expect(result.cart_size_after).toBe(0);\n});\n",
        },
        dtMs: min(9.6),
      },
      { kind: 'tool_result', ok: true, text: 'Wrote file (343 bytes)', dtMs: min(9.7) },
      {
        kind: 'tool_use',
        tool: 'Bash',
        input: {
          command: 'npm run test -- --grep "checkout flow" --repeat 50',
          description: 'Hammer the test 50x to confirm the flake is gone',
        },
        dtMs: min(10.0),
      },
      { kind: 'tool_result', ok: true, text: '50/50 passing', dtMs: min(15.5) },
      {
        kind: 'user',
        text:
          "good. but actually the refund.js one wasn't really a race — that was intentional fire-and-forget for the analytics callback because we don't want refund latency tied to analytics. revert that one.",
        dtMs: min(17.0),
      },
      {
        kind: 'assistant',
        text: "Right — analytics shouldn't block user-visible refund latency. Reverting just refund.js.",
        dtMs: min(17.2),
        usage: { input: 8500, output: 42, cache_read: 19_200, cache_creation: 0 },
      },
      {
        kind: 'tool_use',
        tool: 'Edit',
        input: {
          file_path: '/Users/demo/shop-api/src/checkout/refund.js',
          old_string: 'await analytics.trackRefund(refundId);',
          new_string: 'analytics.trackRefund(refundId); // intentional fire-and-forget',
        },
        dtMs: min(17.4),
      },
      { kind: 'tool_result', ok: true, text: 'Edited successfully', dtMs: min(17.5) },
      {
        kind: 'tool_use',
        tool: 'Bash',
        input: {
          command: 'npm test',
          description: 'Final regression sweep',
        },
        dtMs: min(17.8),
      },
      { kind: 'tool_result', ok: true, text: '218 passing\n0 failing', dtMs: min(20.4) },
      {
        kind: 'assistant',
        text: 'All green. 50 repeats clean on the flaky test, full suite passing. Three real races fixed, one false positive reverted with a comment so future-you knows why.',
        dtMs: min(20.5),
        usage: { input: 8650, output: 84, cache_read: 19_400, cache_creation: 0 },
      },
      { kind: 'turn_duration', durationMs: 1_230_000, dtMs: min(20.6) },
    ],
  },

  // --- 4) Quick migration, 0 interventions, security-review skill, 6 days ago ---
  {
    id: 'demo-stripe-migration',
    project: 'shop',
    branch: 'feat/stripe-pmi-column',
    startOffsetMs: -day(6),
    model: 'claude-sonnet-4-6',
    turns: [
      {
        kind: 'user',
        text:
          'Add a migration that adds `stripe_payment_method_id` (nullable string, 64 chars) to the `orders` table. Backfill to NULL.',
        dtMs: 0,
      },
      {
        kind: 'assistant',
        text:
          "I'll create migration 0042_add_stripe_payment_method.sql with a NOT NULL false constraint. Going to keep it reversible because we touch a hot table.",
        dtMs: min(0.3),
        usage: { input: 3100, output: 78, cache_read: 8200, cache_creation: 0 },
      },
      {
        kind: 'tool_use',
        tool: 'Write',
        input: {
          file_path: '/Users/demo/shop-api/migrations/0042_add_stripe_payment_method.sql',
          content:
            "-- up\nALTER TABLE orders\n  ADD COLUMN stripe_payment_method_id VARCHAR(64) NULL;\n\n-- down\nALTER TABLE orders\n  DROP COLUMN stripe_payment_method_id;\n",
        },
        dtMs: min(0.5),
      },
      { kind: 'tool_result', ok: true, text: 'Wrote file (185 bytes)', dtMs: min(0.6) },
      {
        kind: 'tool_use',
        tool: 'Bash',
        input: {
          command: 'npm run migrate:dryrun -- --to 0042',
          description: 'Dry-run the new migration',
        },
        dtMs: min(0.9),
      },
      {
        kind: 'tool_result',
        ok: true,
        text: 'Would apply 1 migration:\n  0042_add_stripe_payment_method.sql (locks: SHARE)',
        dtMs: min(1.7),
      },
      {
        kind: 'tool_use',
        tool: 'Skill',
        input: { skill: 'security-review', args: 'migrations/0042_add_stripe_payment_method.sql' },
        dtMs: min(2.0),
      },
      {
        kind: 'tool_result',
        ok: true,
        text:
          'security-review: no findings. Column is nullable; stripe pm_xxx ids are non-PII per Stripe docs; no index added so no covert lookup vector.',
        dtMs: min(2.6),
      },
      {
        kind: 'assistant',
        text:
          'Security review clean — stripe pm_xxx ids are non-PII and we left the column unindexed. Migration ready to apply.',
        dtMs: min(2.7),
        usage: { input: 3280, output: 56, cache_read: 8400, cache_creation: 0 },
      },
      { kind: 'turn_duration', durationMs: 162_000, dtMs: min(2.8) },
    ],
  },
];

// ---------- record builder ----------

function isoAt(ms) {
  return new Date(ms).toISOString();
}

function* buildRecords(session) {
  const proj = projects[session.project];
  const start = BASE + session.startOffsetMs;
  let prevUuid = null;
  let toolCounter = 0;
  let msgCounter = 0;

  // permission-mode header (a real session usually starts with this or queue-op).
  yield { type: 'permission-mode', permissionMode: 'default', sessionId: session.id };

  for (const turn of session.turns) {
    const ts = isoAt(start + turn.dtMs);
    const common = {
      cwd: proj.cwd,
      sessionId: session.id,
      gitBranch: session.branch,
      version: '2.1.140',
    };

    if (turn.kind === 'user') {
      const uuid = `${session.id}-u${++msgCounter}`;
      yield {
        parentUuid: prevUuid,
        type: 'user',
        message: { role: 'user', content: turn.text },
        uuid,
        timestamp: ts,
        userType: 'external',
        entrypoint: 'cli',
        ...common,
      };
      prevUuid = uuid;
      continue;
    }

    if (turn.kind === 'assistant') {
      const uuid = `${session.id}-a${++msgCounter}`;
      const msg = {
        role: 'assistant',
        content: [{ type: 'text', text: turn.text }],
        id: `msg_${session.id}_${msgCounter}`,
        model: session.model,
        stop_reason: 'end_turn',
      };
      if (turn.usage) {
        msg.usage = {
          input_tokens: turn.usage.input,
          output_tokens: turn.usage.output,
          cache_read_input_tokens: turn.usage.cache_read,
          cache_creation_input_tokens: turn.usage.cache_creation,
        };
      }
      yield {
        parentUuid: prevUuid,
        type: 'assistant',
        message: msg,
        uuid,
        timestamp: ts,
        ...common,
      };
      prevUuid = uuid;
      continue;
    }

    if (turn.kind === 'tool_use') {
      const toolId = `toolu_${session.id}_${++toolCounter}`;
      const uuid = `${session.id}-a${++msgCounter}`;
      yield {
        parentUuid: prevUuid,
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: toolId, name: turn.tool, input: turn.input }],
          id: `msg_${session.id}_${msgCounter}`,
          model: session.model,
        },
        uuid,
        timestamp: ts,
        __toolUseId: toolId, // private, stripped below
        ...common,
      };
      prevUuid = uuid;
      // Stash for the next tool_result.
      session.__lastToolId = toolId;
      continue;
    }

    if (turn.kind === 'tool_result') {
      const uuid = `${session.id}-u${++msgCounter}`;
      yield {
        parentUuid: prevUuid,
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: session.__lastToolId,
              content: turn.text,
              is_error: !turn.ok,
            },
          ],
        },
        uuid,
        timestamp: ts,
        ...common,
      };
      prevUuid = uuid;
      continue;
    }

    if (turn.kind === 'turn_duration') {
      yield {
        type: 'system',
        subtype: 'turn_duration',
        durationMs: turn.durationMs,
        messageCount: msgCounter,
        timestamp: ts,
        sessionId: session.id,
        gitBranch: session.branch,
      };
      continue;
    }
  }
}

function recordToJsonl(rec) {
  // Strip private fields prefixed with __.
  const clean = {};
  for (const [k, v] of Object.entries(rec)) if (!k.startsWith('__')) clean[k] = v;
  return JSON.stringify(clean);
}

// ---------- main ----------

async function main() {
  // Fresh slate so removed sessions don't linger.
  await rm(demoRoot, { recursive: true, force: true });
  await mkdir(projectsRoot, { recursive: true });

  // Group sessions by project for dir layout.
  for (const p of Object.values(projects)) {
    await mkdir(path.join(projectsRoot, p.encoded), { recursive: true });
  }

  for (const sess of sessions) {
    const proj = projects[sess.project];
    const dir = path.join(projectsRoot, proj.encoded);
    const file = path.join(dir, `${sess.id}.jsonl`);
    const lines = [];
    for (const rec of buildRecords(sess)) lines.push(recordToJsonl(rec));
    await writeFile(file, lines.join('\n') + '\n', 'utf8');
    process.stdout.write(`  wrote ${path.relative(repoRoot, file)} (${lines.length} records)\n`);
  }

  // Dynamic imports so CASTORY_PROJECTS_ROOT is read at module-eval time.
  const { buildIndex } = await import('../src/dashboard.js');
  const { renderDashboardHtml } = await import('../src/render/dashboard-html.js');
  const { renderSessionHtml, renderTimelineBody } = await import('../src/render/session-html.js');
  const { parseSession } = await import('../src/parse.js');
  const { extractEvents } = await import('../src/extract.js');
  const { buildTimeline } = await import('../src/timeline.js');

  // repoRoot=null so the renderer doesn't pick up any .coding-agent-story/sessions
  // committed to this repo (there aren't any today, but stay explicit).
  const index = await buildIndex({ projectsRoot, projectPaths: null, repoRoot: null });

  const fragments = {};
  for (const s of index.sessions) {
    const { events } = await parseSession(s.__sourcePath);
    const evs = extractEvents({ events });
    const timeline = buildTimeline(evs, {
      sessionId: s.id,
      gitBranch: s.git_branch,
      githubBase: s.github_base,
      repoRoot: s.repo_root,
      importantFiles: s.important_files,
    });
    fragments[s.id] = renderTimelineBody(timeline);
  }

  const html = renderDashboardHtml(index, { fragments });
  await writeFile(outHtml, html, 'utf8');
  process.stdout.write(`\ndemo dashboard → ${path.relative(repoRoot, outHtml)}\n`);
  process.stdout.write(`sessions: ${index.sessions.length} · projects: ${index.projects.length}\n`);
}

main().catch((err) => {
  process.stderr.write(`build-demo-dashboard failed: ${err.stack || err.message}\n`);
  process.exit(1);
});
