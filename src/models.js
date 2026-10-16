const Decimal = require('decimal.js');

/**
 * Represents one participant in the susu group.
 *
 * @property {string}  name       - Unique name / ID for this member.
 * @property {number}  joinOrder  - 1-based position in the rotation order.
 */
class Member {
  constructor(name, joinOrder) {
    this.name = typeof name === 'string' ? name.trim() : name;
    this.joinOrder = Number(joinOrder); // 1-based; also determines payout order
  }

  toJSON() {
    return {
      name: this.name,
      joinOrder: this.joinOrder,
    };
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
    this.week = Number(week);
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

  toJSON() {
    return {
      memberName: this.memberName,
      week: this.week,
      totalPaid: this.totalPaid.toFixed(2),
      payments: this.payments.map((p) => p.toFixed(2)),
    };
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
    this.week = Number(week);
    this.recipient = recipient;
    this.amount = new Decimal(amount);
    Object.freeze(this); // immutable once created
  }

  toJSON() {
    return {
      week: this.week,
      recipient: this.recipient,
      amount: this.amount.toFixed(2),
    };
  }

  toString() {
    return `Week ${this.week}: ${this.recipient} received GHS ${this.amount.toFixed(2)}`;
  }
}

module.exports = { Member, Contribution, PayoutRecord };
