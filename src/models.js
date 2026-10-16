const Decimal = require('decimal.js');

/**
 * Represents one participant in the susu group.
 *
 * @property {string}  name       - Unique name / ID for this member.
 * @property {number}  joinOrder  - 1-based position in the rotation order.
 */
class Member {
  constructor(name, joinOrder) {
    this.name = name;
    this.joinOrder = joinOrder; // 1-based; also determines payout order
  }
}

/**
 * Tracks every payment a member makes toward a specific week.
 * Partial payments are accumulated in the `payments` array.
 *
 * @property {string}    memberName
 * @property {number}    week
 * @property {Decimal[]} payments   - Individual payment instalments.
 */
class Contribution {
  constructor(memberName, week) {
    this.memberName = memberName;
    this.week = week;
    this.payments = []; // array of Decimal
  }

  /** Sum of all recorded payments for this (member, week) pair. */
  get totalPaid() {
    return this.payments.reduce((sum, p) => sum.plus(p), new Decimal(0));
  }

  /** Append a single payment instalment. */
  addPayment(amount) {
    this.payments.push(new Decimal(amount));
  }
}

/**
 * An immutable record written when a week successfully closes and
 * the pot is disbursed to a member.
 *
 * @property {number}  week      - The closed week number.
 * @property {string}  recipient - Name of the member who received the pot.
 * @property {Decimal} amount    - GHS amount paid out.
 */
class PayoutRecord {
  constructor(week, recipient, amount) {
    this.week = week;
    this.recipient = recipient;
    this.amount = new Decimal(amount);
    Object.freeze(this); // immutable once created
  }

  toString() {
    return `Week ${this.week}: ${this.recipient} received GHS ${this.amount.toFixed(2)}`;
  }
}

module.exports = { Member, Contribution, PayoutRecord };
