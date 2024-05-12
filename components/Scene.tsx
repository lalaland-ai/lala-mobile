import { Canvas } from "@react-three/fiber/native";
import { PerspectiveCamera, Plane } from "@react-three/drei/native";
import VrmAvatar from "./VrmAvatar";
import { Matrix4, Vector3, Quaternion, Euler, MathUtils } from "three";
import { defaultAnimations } from "../constants/animations";

export default function App() {
  return (
    <>
      <Canvas>
        <PerspectiveCamera
          makeDefault
          position={[0, 0.3, 1.75]}
          rotation={[-Math.PI / 12, 0, 0]}
        />

        <ambientLight intensity={0.7} />

        <pointLight position={[0, -10, -10]} decay={0} intensity={1} />

        <VrmAvatar
          matrix={new Matrix4().compose(
            new Vector3(0, -1, 0),
            new Quaternion().setFromEuler(
              new Euler(0, MathUtils.degToRad(180), 0)
            ),
            new Vector3(1, 1, 1)
          )}
          vrmUrl="https://lalaland.chat/vrms/purple-girl.vrm"
          animations={defaultAnimations}
          audioRef={undefined}
          scale={[1, 1, 1]}
        />

        <color attach="background" args={["#141414"]} />

        <Plane
          args={[20, 20, 20, 20]}
          position={[0, -1, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <meshStandardMaterial color="#292929" wireframe />
        </Plane>
      </Canvas>
    </>
  );
}
