import { Container, SignatureDefinitionBaseType } from 'meta-utils';

import { ClassType } from '../entities/class-type';
import { KeyType } from '../entities/key-type';
import { NIL_TYPE_ID } from '../types/type';
import { TypeStorage } from './type-storage';

export class GlobalTypeStorage extends TypeStorage {
  insertPrimitives(container: Container) {
    container.getPrimitives().forEach((signature, type) => {
      const classType = new ClassType(type, null, null, this);
      classType.insertSignature(signature);
      this.typeInterfaces.set(type, classType);
      this.keyTypes.set(type, new KeyType(type, this));
    });

    const classType = new ClassType(NIL_TYPE_ID, null, null, this);
    this.typeInterfaces.set(NIL_TYPE_ID, classType);
    this.keyTypes.set(NIL_TYPE_ID, new KeyType(NIL_TYPE_ID, this));
  }

  insertNonPrimitives(container: Container) {
    container.getTypes().forEach((signature, type) => {
      const classType = new ClassType(type, null, null, this);

      classType.insertSignature(signature);
      this.typeInterfaces.set(type, classType);
      this.keyTypes.set(type, new KeyType(type, this));
    });
  }

  insertAllAnyTypeMembers(container: Container) {
    const anyType = this.typeInterfaces.get(SignatureDefinitionBaseType.Any);

    container.getPrimitives().forEach((signature) => {
      if (signature.getType() === SignatureDefinitionBaseType.General) return;
      anyType.insertSignature(signature);
    });

    container.getTypes().forEach((signature) => {
      anyType.insertSignature(signature);
    });
  }
}
