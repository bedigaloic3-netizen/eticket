import { type User, type InsertUser, type Staff, type InsertStaff } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Staff methods
  getStaff(id: string): Promise<Staff | undefined>;
  getAllStaff(): Promise<Staff[]>;
  addStaff(staff: InsertStaff): Promise<Staff>;
  removeStaff(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private staff: Map<string, Staff>;

  constructor() {
    this.users = new Map();
    this.staff = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getStaff(id: string): Promise<Staff | undefined> {
    return this.staff.get(id);
  }

  async getAllStaff(): Promise<Staff[]> {
    return Array.from(this.staff.values());
  }

  async addStaff(insertStaff: InsertStaff): Promise<Staff> {
    this.staff.set(insertStaff.id, insertStaff);
    return insertStaff;
  }

  async removeStaff(id: string): Promise<void> {
    this.staff.delete(id);
  }
}

export const storage = new MemStorage();
