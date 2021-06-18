import * as THREE from "three";
import React, { useEffect, useRef } from "react";
import { TextureLoader } from "three";
import { useControls } from "leva";

import atlas from "../../../static/textures/textureAtlas.png";
import VoxelWorld from "./VoxelWorld";

function randInt(min, max) { return Math.floor(Math.random() * (max - min) + min); }


const CUBES = new THREE.Object3D();
const tileSize = 16;
const tileTextureWidth = 256;
const tileTextureHeight = 64;

export default function WORLD({ cellSize }) {


    const loader = new TextureLoader();
    const texture = loader.load(atlas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    const world = new VoxelWorld({ cellSize, tileSize, tileTextureWidth, tileTextureHeight });
    const material = new THREE.MeshLambertMaterial({ map: texture, side: THREE.FrontSide, alphaTest: 0.1, transparent: true, wireframe: true });
    const geometry = new THREE.BufferGeometry();
    const positionNumComponents = 3;
    const normalNumComponents = 3;
    const uvNumComponents = 2;
    const ref = useRef();

    useEffect(() => {
        let counter = 0;
        for (let y = 0; y < cellSize; ++y) {
            for (let z = 0; z < cellSize; ++z) {
                for (let x = 0; x < cellSize; ++x) {
                    const height = (Math.sin(x / cellSize * Math.PI * 2) + Math.sin(z / cellSize * Math.PI * 3)) * (cellSize / 6) + (cellSize / 2);
                    if (y < height) {
                        world.setVoxel(x, y, z, randInt(1, 17)); // random int from 1 - 17 
                        const id = counter += 1;
                        ref.current.setMatrixAt(id, CUBES.matrix);
                        // CUBES.updateMatrix();
                    }
                }
            }
        }
        const { positions, normals, uvs, indices } = world.generateGeometryDataForCell(0, 0, 0);
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), positionNumComponents));
        geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), normalNumComponents));
        geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), uvNumComponents));
        geometry.setIndex(indices);
        ref.current.instanceMatrix.needsUpdate = true;
    }, []);

    return (
        <instancedMesh ref={ref}
            dispose={null}
            // updateMorphTargets
            material={material}
            geometry={geometry}
            args={[geometry, material, cellSize * cellSize * cellSize]} />
    );
}

