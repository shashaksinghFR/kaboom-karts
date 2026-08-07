import { TransformNode, AbstractMesh } from "@babylonjs/core";

export interface IEntityVisual {
  rootNode: TransformNode;
  meshes: AbstractMesh[];
  update(deltaTime: number): void;
  dispose(): void;
}

export interface IKartVisual extends IEntityVisual {
  setSteeringVisual(steerAngleRadians: number): void;
  setWheelSpin(rollingSpeed: number): void;
  setBoostEffect(active: boolean): void;
}

export interface IMissileVisual extends IEntityVisual {
  explode(): void;
}
