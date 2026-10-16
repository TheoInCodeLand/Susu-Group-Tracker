/**
 * tests/susuGroup.test.js
 *
 * Automated tests for SusuGroup core logic.
 *
 * Run with:  npm test
 */

'use strict';

const Decimal = require('decimal.js');
const SusuGroup = require('../src/SusuGroup');
const {
  SusuError,
  UnknownMemberError,
  DuplicateMemberError,
  InvalidAmountError,
  OverpaymentError,
  WeekAlreadyClosedError,
  LateJoinError,
  GroupNotReadyError,
} = require('../src/errors');

// ─── Helper ───────────────────────────────────────────────────────────────────
/** Create a 3-member group (Ama, Kofi, Esi) with GHS 50.00/week. */
function makeGroup() {
  const g = new SusuGroup('Test Susu', '50.00');
  g.addMember('Ama');
  g.addMember('Kofi');
  g.addMember('Esi');
  return g;
}

// ─── 1. Group creation ────────────────────────────────────────────────────────
describe('Group creation', () => {
  test('creates a group with correct weeklyAmount', () => {
    const g = new SusuGroup('Savings Club', '50.00');
    expect(g.weeklyAmount.toString()).toBe('50');
    expect(g.groupName).toBe('Savings Club');
    expect(g.currentWeek).toBe(1);
  });

  test('rejects a zero weekly amount', () => {
    expect(() => new SusuGroup('Bad Group', '0')).toThrow(InvalidAmountError);
  });

  test('rejects a negative weekly amount', () => {
    expect(() => new SusuGroup('Bad Group', '-10')).toThrow(InvalidAmountError);
  });
});

// ─── 2. Member management ─────────────────────────────────────────────────────
describe('Member management', () => {
  test('adds members and assigns join order', () => {
    const g = makeGroup();
    expect(g.members).toHaveLength(3);
    expect(g.members[0].joinOrder).toBe(1);
    expect(g.members[2].joinOrder).toBe(3);
  });

  test('rejects a duplicate member name', () => {
    const g = new SusuGroup('Test', '50');
    g.addMember('Ama');
    expect(() => g.addMember('Ama')).toThrow(DuplicateMemberError);
  });

  test('rejects an empty member name', () => {
    const g = new SusuGroup('Test', '50');
    expect(() => g.addMember('  ')).toThrow(InvalidAmountError);
  });

  test('rejects adding a member after contributions have started (late-join rule)', () => {
    const g = makeGroup();
    g.recordContribution('Ama', 1, '50.00');
    expect(() => g.addMember('Kwame')).toThrow(LateJoinError);
  });
});

// ─── 3. Contributions ─────────────────────────────────────────────────────────
describe('Contributions', () => {
  test('records a full payment correctly', () => {
    const g = makeGroup();
    const contrib = g.recordContribution('Ama', 1, '50.00');
    expect(contrib.totalPaid.toString()).toBe('50');
  });

  test('accumulates partial payments exactly (no rounding errors)', () => {
    const g = makeGroup();
    g.recordContribution('Esi', 1, '30.00');
    const contrib = g.recordContribution('Esi', 1, '20.00');
    // Using Decimal throughout – result must be exactly 50, not 49.999...
    expect(contrib.totalPaid.equals(new Decimal('50'))).toBe(true);
  });

  test('rejects an unknown member', () => {
    const g = makeGroup();
    expect(() => g.recordContribution('Ghost', 1, '50')).toThrow(UnknownMemberError);
  });

  test('rejects a zero contribution', () => {
    const g = makeGroup();
    expect(() => g.recordContribution('Ama', 1, '0')).toThrow(InvalidAmountError);
  });

  test('rejects a negative contribution', () => {
    const g = makeGroup();
    expect(() => g.recordContribution('Ama', 1, '-5')).toThrow(InvalidAmountError);
  });

  test('rejects a payment that exceeds what the member still owes (overpayment)', () => {
    const g = makeGroup();
    g.recordContribution('Ama', 1, '40.00');
    // Ama still owes 10.00; paying 15.00 would be an overpayment
    expect(() => g.recordContribution('Ama', 1, '15.00')).toThrow(OverpaymentError);
  });

  test('rejects a contribution for a closed week', () => {
    const g = makeGroup();
    // Pay everyone in full and close week 1
    g.recordContribution('Ama',  1, '50');
    g.recordContribution('Kofi', 1, '50');
    g.recordContribution('Esi',  1, '50');
    g.closeWeek();
    // Now try to contribute to the closed week
    expect(() => g.recordContribution('Ama', 1, '50')).toThrow(WeekAlreadyClosedError);
  });

  test('rejects a contribution for a future / wrong week', () => {
    const g = makeGroup();
    expect(() => g.recordContribution('Ama', 2, '50')).toThrow(InvalidAmountError);
  });
});

// ─── 4. Week closing ──────────────────────────────────────────────────────────
describe('Week closing', () => {
  test('week cannot close when a member has only partially paid', () => {
    const g = makeGroup();
    g.recordContribution('Ama',  1, '50');
    g.recordContribution('Kofi', 1, '50');
    g.recordContribution('Esi',  1, '30'); // partial – owes 20 more
    const result = g.closeWeek();
    expect(result.closed).toBe(false);
    expect(result.outstanding).toHaveLength(1);
    expect(result.outstanding[0].member).toBe('Esi');
    expect(result.outstanding[0].owes.toFixed(2)).toBe('20.00');
  });

  test('week cannot close when nobody has paid', () => {
    const g = makeGroup();
    const result = g.closeWeek();
    expect(result.closed).toBe(false);
    expect(result.outstanding).toHaveLength(3);
  });

  test('week closes successfully after partial payments complete the balance', () => {
    const g = makeGroup();
    // Reproduce the spec example exactly
    g.recordContribution('Ama',  1, '50');
    g.recordContribution('Kofi', 1, '50');
    g.recordContribution('Esi',  1, '30');
    const r1 = g.closeWeek();
    expect(r1.closed).toBe(false); // Esi still owes 20

    g.recordContribution('Esi',  1, '20');
    const r2 = g.closeWeek();
    expect(r2.closed).toBe(true);
    expect(r2.payout.recipient).toBe('Ama');           // first member gets week-1 pot
    expect(r2.payout.amount.toFixed(2)).toBe('150.00'); // 3 × GHS 50
    expect(g.currentWeek).toBe(2);
  });

  test('payout follows join order across multiple weeks', () => {
    const g = makeGroup();
    const payAllFor = (week) => {
      g.recordContribution('Ama',  week, '50');
      g.recordContribution('Kofi', week, '50');
      g.recordContribution('Esi',  week, '50');
      return g.closeWeek();
    };

    const w1 = payAllFor(1);
    const w2 = payAllFor(2);
    const w3 = payAllFor(3);

    expect(w1.payout.recipient).toBe('Ama');   // join order 1
    expect(w2.payout.recipient).toBe('Kofi');  // join order 2
    expect(w3.payout.recipient).toBe('Esi');   // join order 3
  });

  test('cannot close an already-closed week (forced via currentWeek roll-back)', () => {
    const g = makeGroup();
    g.recordContribution('Ama',  1, '50');
    g.recordContribution('Kofi', 1, '50');
    g.recordContribution('Esi',  1, '50');
    g.closeWeek();
    // Artificially roll currentWeek back to 1 so closeWeek targets week 1 again
    g.currentWeek = 1;
    expect(() => g.closeWeek()).toThrow(WeekAlreadyClosedError);
  });
});

// ─── 5. Report ────────────────────────────────────────────────────────────────
describe('Report', () => {
  test('report lists paid and outstanding members correctly', () => {
    const g = makeGroup();
    g.recordContribution('Ama',  1, '50');
    g.recordContribution('Kofi', 1, '25'); // partial

    const report = g.getReport();

    expect(report.paidInFull).toContain('Ama');
    expect(report.paidInFull).not.toContain('Kofi');
    const kofiEntry = report.outstanding.find((o) => o.member === 'Kofi');
    expect(kofiEntry.owes).toBe('25.00');
  });

  test('report includes payout history after a closed week', () => {
    const g = makeGroup();
    g.recordContribution('Ama',  1, '50');
    g.recordContribution('Kofi', 1, '50');
    g.recordContribution('Esi',  1, '50');
    g.closeWeek();

    const report = g.getReport();
    expect(report.payoutHistory).toHaveLength(1);
    expect(report.payoutHistory[0].recipient).toBe('Ama');
    expect(report.payoutHistory[0].amount).toBe('150.00');
  });
});

// ─── 6. Edge cases ────────────────────────────────────────────────────────────
describe('Edge cases', () => {
  test('group needs at least 2 members to accept contributions', () => {
    const g = new SusuGroup('Solo', '50');
    g.addMember('Ama');
    expect(() => g.recordContribution('Ama', 1, '50')).toThrow(GroupNotReadyError);
  });

  test('pot amount uses exact Decimal arithmetic (3 × 33.33 = 99.99, not 100)', () => {
    // Demonstrates why we use Decimal and not floats.
    const g = new SusuGroup('Odd', '33.33');
    g.addMember('A'); g.addMember('B'); g.addMember('C');
    g.recordContribution('A', 1, '33.33');
    g.recordContribution('B', 1, '33.33');
    g.recordContribution('C', 1, '33.33');
    const result = g.closeWeek();
    expect(result.closed).toBe(true);
    // 3 × 33.33 = 99.99 exactly (Decimal), NOT floating-point garbage
    expect(result.payout.amount.toFixed(2)).toBe('99.99');
  });
});
