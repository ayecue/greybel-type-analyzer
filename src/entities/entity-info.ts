import { IEntityInfo } from '../types/type';
import { Type } from './type';

export class EntityInfo implements IEntityInfo {
  public readonly name: string;
  public type: Type;

  constructor(name: string, type: Type) {
    this.name = name;
    this.type = type;
  }
}
