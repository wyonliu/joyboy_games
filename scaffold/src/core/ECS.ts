/**
 * Lightweight Entity-Component-System for game objects.
 * Simple but powerful enough for casual/roguelike games.
 */

export type ComponentType = string;

export interface Component {
  type: ComponentType;
  [key: string]: any;
}

let nextEntityId = 0;

export class Entity {
  readonly id: number;
  private components: Map<ComponentType, Component> = new Map();
  active = true;
  tags: Set<string> = new Set();

  constructor() {
    this.id = nextEntityId++;
  }

  add<T extends Component>(component: T): this {
    this.components.set(component.type, component);
    return this;
  }

  get<T extends Component>(type: ComponentType): T | undefined {
    return this.components.get(type) as T | undefined;
  }

  has(type: ComponentType): boolean {
    return this.components.has(type);
  }

  remove(type: ComponentType): this {
    this.components.delete(type);
    return this;
  }

  hasAll(...types: ComponentType[]): boolean {
    return types.every(t => this.components.has(t));
  }

  tag(t: string): this { this.tags.add(t); return this; }
  hasTag(t: string): boolean { return this.tags.has(t); }
}

export class World {
  private entities: Map<number, Entity> = new Map();
  private toAdd: Entity[] = [];
  private toRemove: number[] = [];

  spawn(): Entity {
    const e = new Entity();
    this.toAdd.push(e);
    return e;
  }

  despawn(id: number) {
    this.toRemove.push(id);
  }

  query(...types: ComponentType[]): Entity[] {
    const result: Entity[] = [];
    for (const e of this.entities.values()) {
      if (e.active && e.hasAll(...types)) result.push(e);
    }
    return result;
  }

  queryTag(tag: string): Entity[] {
    const result: Entity[] = [];
    for (const e of this.entities.values()) {
      if (e.active && e.hasTag(tag)) result.push(e);
    }
    return result;
  }

  getById(id: number): Entity | undefined {
    return this.entities.get(id);
  }

  flush() {
    for (const e of this.toAdd) this.entities.set(e.id, e);
    this.toAdd = [];
    for (const id of this.toRemove) this.entities.delete(id);
    this.toRemove = [];
  }

  clear() {
    this.entities.clear();
    this.toAdd = [];
    this.toRemove = [];
  }

  get count(): number {
    return this.entities.size;
  }

  all(): Entity[] {
    return Array.from(this.entities.values());
  }
}
