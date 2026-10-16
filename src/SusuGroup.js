/**
 * SusuGroup – core business logic for a rotating savings group.
 *
 * ─────────────────────────────────────────────
 *  HOW IT WORKS
 * ─────────────────────────────────────────────
 *  1. Create a group with a fixed weekly contribution (GHS).
 *  2. Add members before week 1 contributions begin.
 *  3. Record contributions (partial payments allowed).
 *  4. Close the week:
 *       • If every member has paid in full → disburse the pot to the
 *         next member in join order and advance to week N+1.
 *       • Otherwise → return a list of outstanding debts; week stays open.
 *  5. Retrieve a full report at any time.
 *
 * ─────────────────────────────────────────────
 *  ASSUMPTIONS (see NOTES.md for full list)
 * ─────────────────────────────────────────────
 *  • Members may only be added before the first contribution is recorded.
 *  • The group needs at least 2 members before it can accept contributions.
 *  • All money is in GHS, stored as decimal.js Decimal objects.
 *  • Week numbers are 1-based.
 *  • Payout rotation stops when every member has received the pot once.
 */

const Decimal = require('decimal.js');
const { Member, Contribution, PayoutRecord } = require('./models');
const {
  UnknownMemberError,
  DuplicateMemberError,
  InvalidAmountError,
  OverpaymentError,
  WeekAlreadyClosedError,
  LateJoinError,
  GroupNotReadyError,
} = require('./errors');

class SusuGroup {
  /**
   * @param {string} groupName        - Display name for this group.
   * @param {string|number} weeklyAmount - Fixed contribution per member per week (GHS).
   */
  constructor(groupName, weeklyAmount) {
    const amt = new Decimal(weeklyAmount);
    if (amt.lte(0)) {
      throw new InvalidAmountError(
        `Weekly amount must be positive; got ${weeklyAmount}`
      );
    }

    this.groupName = groupName;
    this.weeklyAmount = amt; // Decimal – never a float

    /** @type {Member[]} Ordered by join_order (index 0 = first to join). */
    this.members = [];

    /** @type {Map<string, Member>} Fast name → Member lookup. */
    this._memberMap = new Map();

    /** @type {number} Current open week (1-based). */
    this.currentWeek = 1;

    /**
     * contributions[week][memberName] → Contribution object.
     * @type {Object.<number, Object.<string, Contribution>>}
     */
    this.contributions = {};

    /** @type {Set<number>} Week numbers that have been closed. */
    this._closedWeeks = new Set();

    /** @type {PayoutRecord[]} History of all successful payouts. */
    this.payoutHistory = [];

    /**
     * True once at least one contribution has been recorded.
     * Used to enforce the late-join rule.
     */
    this._contributionsStarted = false;
  }

  // ─────────────────────────────────────────────
  //  MEMBER MANAGEMENT
  // ─────────────────────────────────────────────

  /**
   * Add a new member to the group.
   *
   * Rules enforced:
   *  • Name must be a non-empty string.
   *  • Name must be unique (case-insensitive comparison is NOT applied –
   *    "Ama" and "ama" are treated as different identifiers by design,
   *    matching the spec that uses names as IDs).
   *  • No new members after contributions have started (late-join rule).
   *
   * @param {string} name
   * @returns {Member} The newly created member.
   */
  addMember(name) {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new InvalidAmountError('Member name must be a non-empty string.');
    }
    const trimmed = name.trim();

    if (this._contributionsStarted) {
      throw new LateJoinError(
        `Cannot add "${trimmed}" – contributions for week ${this.currentWeek} have already begun. ` +
          'New members may only join before the first payment is recorded.'
      );
    }

    if (this._memberMap.has(trimmed)) {
      throw new DuplicateMemberError(
        `A member named "${trimmed}" already exists in this group.`
      );
    }

    const member = new Member(trimmed, this.members.length + 1);
    this.members.push(member);
    this._memberMap.set(trimmed, member);
    return member;
  }

  // ─────────────────────────────────────────────
  //  CONTRIBUTIONS
  // ─────────────────────────────────────────────

  /**
   * Record a contribution (or partial contribution) for a member.
   *
   * Rules enforced:
   *  • Member must exist.
   *  • Week must be the current open week.
   *  • Amount must be a positive Decimal-parseable value.
   *  • Payment must not exceed the member's remaining balance for the week.
   *  • Group must have at least 2 members.
   *
   * @param {string}        memberName
   * @param {number}        week        - Must equal currentWeek.
   * @param {string|number} amount      - GHS amount to record.
   * @returns {Contribution} The updated Contribution object.
   */
  recordContribution(memberName, week, amount) {
    // ── validate group readiness ──────────────────
    if (this.members.length < 2) {
      throw new GroupNotReadyError(
        'A susu group needs at least 2 members before contributions can be recorded.'
      );
    }

    // ── validate member ───────────────────────────
    if (!this._memberMap.has(memberName)) {
      throw new UnknownMemberError(
        `No member named "${memberName}" in this group.`
      );
    }

    // ── validate week ─────────────────────────────
    if (week !== this.currentWeek) {
      if (this._closedWeeks.has(week)) {
        throw new WeekAlreadyClosedError(`Week ${week} is already closed.`);
      }
      throw new InvalidAmountError(
        `Cannot record a contribution for week ${week}; current open week is ${this.currentWeek}.`
      );
    }

    // ── validate amount ───────────────────────────
    let decAmount;
    try {
      decAmount = new Decimal(amount);
    } catch {
      throw new InvalidAmountError(`"${amount}" is not a valid number.`);
    }

    if (decAmount.lte(0)) {
      throw new InvalidAmountError(
        `Contribution amount must be positive; got ${amount}.`
      );
    }

    // ── check for overpayment ─────────────────────
    const contribution = this._getOrCreateContribution(memberName, week);
    const alreadyPaid = contribution.totalPaid;
    const remaining = this.weeklyAmount.minus(alreadyPaid);

    if (decAmount.gt(remaining)) {
      throw new OverpaymentError(
        `Payment of GHS ${decAmount.toFixed(2)} exceeds what ${memberName} still owes ` +
          `(GHS ${remaining.toFixed(2)}) for week ${week}.`
      );
    }

    contribution.addPayment(decAmount);
    this._contributionsStarted = true;
    return contribution;
  }

  // ─────────────────────────────────────────────
  //  WEEK MANAGEMENT
  // ─────────────────────────────────────────────

  /**
   * Attempt to close the current week.
   *
   * @returns {{ closed: boolean, payout?: PayoutRecord, outstanding?: Array }}
   *   - If every member has paid in full:
   *       `{ closed: true, payout: PayoutRecord }`
   *   - Otherwise:
   *       `{ closed: false, outstanding: [{ member, owes }] }`
   */
  closeWeek() {
    if (this.members.length < 2) {
      throw new GroupNotReadyError(
        'Cannot close a week with fewer than 2 members.'
      );
    }

    const week = this.currentWeek;

    if (this._closedWeeks.has(week)) {
      throw new WeekAlreadyClosedError(`Week ${week} is already closed.`);
    }

    // ── check who hasn't paid in full ─────────────
    const outstanding = [];
    for (const member of this.members) {
      const contribution = this._getOrCreateContribution(member.name, week);
      const paid = contribution.totalPaid;
      const owed = this.weeklyAmount.minus(paid);
      if (owed.gt(0)) {
        outstanding.push({ member: member.name, owes: owed });
      }
    }

    if (outstanding.length > 0) {
      return { closed: false, outstanding };
    }

    // ── all paid – disburse the pot ───────────────
    const potAmount = this.weeklyAmount.times(this.members.length);

    // Recipient = member whose joinOrder equals the current week number.
    // Once all members have received the pot the rotation is complete.
    const recipientIndex = (week - 1) % this.members.length;
    const recipient = this.members[recipientIndex];

    const record = new PayoutRecord(week, recipient.name, potAmount);
    this.payoutHistory.push(record);
    this._closedWeeks.add(week);
    this.currentWeek = week + 1;
    this._contributionsStarted = false; // reset so new week starts fresh

    return { closed: true, payout: record };
  }

  // ─────────────────────────────────────────────
  //  REPORTING
  // ─────────────────────────────────────────────

  /**
   * Generate a snapshot report for the current week.
   *
   * @returns {{
   *   groupName: string,
   *   weeklyAmount: string,
   *   currentWeek: number,
   *   memberCount: number,
   *   paidInFull: string[],
   *   outstanding: Array<{ member: string, paid: string, owes: string }>,
   *   payoutHistory: Array<{ week: number, recipient: string, amount: string }>
   * }}
   */
  getReport() {
    const week = this.currentWeek;
    const paidInFull = [];
    const outstanding = [];

    for (const member of this.members) {
      const contribution = this._getOrCreateContribution(member.name, week);
      const paid = contribution.totalPaid;
      const owes = this.weeklyAmount.minus(paid);

      if (owes.lte(0)) {
        paidInFull.push(member.name);
      } else {
        outstanding.push({
          member: member.name,
          paid: paid.toFixed(2),
          owes: owes.toFixed(2),
        });
      }
    }

    return {
      groupName: this.groupName,
      weeklyAmount: this.weeklyAmount.toFixed(2),
      currentWeek: week,
      memberCount: this.members.length,
      paidInFull,
      outstanding,
      payoutHistory: this.payoutHistory.map((r) => ({
        week: r.week,
        recipient: r.recipient,
        amount: r.amount.toFixed(2),
      })),
    };
  }

  // ─────────────────────────────────────────────
  //  PRIVATE HELPERS
  // ─────────────────────────────────────────────

  /** Retrieve or lazily create a Contribution record. */
  _getOrCreateContribution(memberName, week) {
    if (!this.contributions[week]) {
      this.contributions[week] = {};
    }
    if (!this.contributions[week][memberName]) {
      this.contributions[week][memberName] = new Contribution(
        memberName,
        week
      );
    }
    return this.contributions[week][memberName];
  }
}

module.exports = SusuGroup;
