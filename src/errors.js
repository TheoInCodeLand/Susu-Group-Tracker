/**
 * SusuError – base class for all domain errors.
 * Callers can distinguish business-rule violations from unexpected bugs
 * by checking `err instanceof SusuError`.
 */
class SusuError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

class UnknownMemberError extends SusuError {}
class DuplicateMemberError extends SusuError {}
class InvalidAmountError extends SusuError {}
class OverpaymentError extends SusuError {}
class WeekAlreadyClosedError extends SusuError {}
class LateJoinError extends SusuError {}
class GroupNotReadyError extends SusuError {}

module.exports = {
  SusuError,
  UnknownMemberError,
  DuplicateMemberError,
  InvalidAmountError,
  OverpaymentError,
  WeekAlreadyClosedError,
  LateJoinError,
  GroupNotReadyError,
};
