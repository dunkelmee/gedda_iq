'use strict';

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Addition / subtraction wrong answers ─────────────────────────────────────
// Believable errors: small offsets, decade slips, digit swaps

function buildAddSubChoices(correct) {
  const wrongSet = new Set();

  const offsets = shuffle([1, -1, 2, -2, 9, -9, 10, -10, 11, -11, 3, -3, 20, -20]);
  for (const offset of offsets) {
    const v = correct + offset;
    if (v > 0 && v !== correct && !wrongSet.has(v)) {
      wrongSet.add(v);
      if (wrongSet.size === 3) break;
    }
  }

  // Digit-swap fallback
  if (wrongSet.size < 3) {
    const s = String(correct);
    if (s.length === 2) {
      const swapped = parseInt(s[1] + s[0]);
      if (swapped > 0 && swapped !== correct && !wrongSet.has(swapped)) wrongSet.add(swapped);
    }
  }

  let fb = correct + 4;
  while (wrongSet.size < 3) {
    if (!wrongSet.has(fb) && fb !== correct && fb > 0) wrongSet.add(fb);
    fb++;
  }

  return shuffle([correct, ...wrongSet]);
}

// ── Multiplication wrong answers ──────────────────────────────────────────────
// Believable errors: off-by-one factor, decade slip, carry mistake

function buildMulChoices(a, b, correct) {
  const wrongSet = new Set();

  const candidates = shuffle([
    (a + 1) * b,       // forgot to stop one step early
    (a - 1) * b,
    a * (b + 1),
    a * (b - 1),
    correct + a,       // added one extra row
    correct - a,
    correct + b,
    correct - b,
    correct + 10,      // decade slip
    correct - 10,
    correct + 1,
    correct - 1,
  ]);

  for (const v of candidates) {
    if (v > 0 && v !== correct && !wrongSet.has(v)) {
      wrongSet.add(v);
      if (wrongSet.size === 3) break;
    }
  }

  let fb = correct + 3;
  while (wrongSet.size < 3) {
    if (!wrongSet.has(fb) && fb !== correct && fb > 0) wrongSet.add(fb);
    fb++;
  }

  return shuffle([correct, ...wrongSet]);
}

// ── Question generators ───────────────────────────────────────────────────────

function generateAddSub(id) {
  const isAdd = Math.random() < 0.5;
  let a = rand(10, 99);
  let b = rand(10, 99);
  let correct, expression;

  if (isAdd) {
    correct = a + b;
    expression = `${a} + ${b} = ?`;
  } else {
    if (a < b) [a, b] = [b, a];
    correct = a - b;
    expression = `${a} − ${b} = ?`;
  }

  return { id, expression, correctAnswer: correct, choices: buildAddSubChoices(correct) };
}

function generateMul(id) {
  // Keep it mentally manageable: 12–29 × 2–9
  const a = rand(12, 29);
  const b = rand(2, 9);
  const correct = a * b;
  return {
    id,
    expression: `${a} × ${b} = ?`,
    correctAnswer: correct,
    choices: buildMulChoices(a, b, correct),
  };
}

function generateQuestion(id) {
  // Equal split: add/sub 67 %, multiplication 33 %
  return Math.random() < 0.33 ? generateMul(id) : generateAddSub(id);
}

function generateQuestions(count) {
  return Array.from({ length: count }, (_, i) => generateQuestion(i));
}

module.exports = { generateQuestions };
