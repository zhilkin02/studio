import { EventEmitter } from 'events';

// This is a global event emitter for handling specific types of errors, like permission errors.
export const errorEmitter = new EventEmitter();
