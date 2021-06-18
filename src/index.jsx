
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box } from '@react-three/drei';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom';
import './index.css';

import Stats from './Components/Stats/Stats';
import WORLD from './Components/World/World';

/**
 * TODO:
 * Procedural Terrain
 * Textures 
 * Add block create Block
 */

function Lights() {
    return (
        <>
            <directionalLight color={"#ffffff"} intensity={1} position={-1, 2, 4} />
            <directionalLight color={"#ffffff"} intensity={1} position={1, -1, -2} />
        </>
    );
}


const CELLSIZE = 5;

function Main() {
    return (
        <>
            <Canvas
                shadows
                gl={{ antialias: true, alpha: false, shadowMap: true, powerPreference: 'high-performance' }}
                camera={{ fov: 75, position: [-CELLSIZE * 3, CELLSIZE * .8, CELLSIZE * .3], near: 0.1, far: 1000 }}
            // raycaster={{ computeOffsets: (e) => ({ offsetX: e.target.width / 2, offsetY: e.target.height / 2 }) }}
            >
                <Suspense fallback={null}>
                    <Lights />
                    <WORLD cellSize={CELLSIZE} />
                    <OrbitControls target={[CELLSIZE / 2, CELLSIZE / 3, CELLSIZE / 2]} />
                    <Stats />
                </Suspense>
            </Canvas >
        </>
    );
}


ReactDOM.render(
    <>
        <Main />
    </>
    ,
    document.getElementById('root')
);