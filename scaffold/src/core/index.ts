/**
 * JoyBoy Game Engine - Public API
 */

export { Engine, Scene } from './Engine.js';
export type { GameConfig, UpdateFn, RenderFn } from './Engine.js';
export { Input } from './Input.js';
export type { Vec2 } from './Input.js';
export { Entity, World } from './ECS.js';
export type { Component, ComponentType } from './ECS.js';
export { Audio } from './Audio.js';
export { Camera } from './Camera.js';
export { ParticleSystem } from './Particles.js';
export type { ParticleConfig } from './Particles.js';
export * from './Utils.js';
export { detectPlatform, WebPlatform, PokiPlatform } from '../platform/PlatformAdapter.js';
export type { PlatformAdapter } from '../platform/PlatformAdapter.js';
