/**
 * In-Memory Database
 * ==================
 * This is a simple in-memory store for development and testing.
 * In production, replace this with MongoDB (mongoose) or PostgreSQL (prisma).
 *
 * MongoDB collections equivalent:
 *   db.users, db.wallets, db.transactions, db.withdrawals
 */

const db = {
  users: [],        // { id, name, phone, deviceId, referralCode, referredBy, createdAt }
  wallets: [],      // { userId, balance, updatedAt }
  transactions: [], // { id, userId, type, amount, title, description, createdAt }
  withdrawals: [],  // { id, userId, amount, method, destination, status, createdAt }
  payments: [],     // { userId, upiId, bankAccountNumber, bankIFSC, bankHolderName, preferredMethod }
};

module.exports = db;
