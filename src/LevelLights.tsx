import React from "react";

export function LevelLights(): React.JSX.Element {
  return (
    <>
      {/* Strong ambient so everything is visible */}
      <ambientLight intensity={1.5} color="#eeccaa" />
      <hemisphereLight args={["#ffeedd", "#665544", 0.8]} />

      {/* Key point lights for atmosphere - much stronger */}
      <pointLight position={[3, 3.5, 4]} intensity={6.0} color="#ffaa66" distance={30} />
      <pointLight position={[8, 3.5, 8]} intensity={5.0} color="#ff9944" distance={25} />
      <pointLight position={[20, 3.5, 14]} intensity={4.0} color="#ffcc88" distance={30} />
      <pointLight position={[36, 3.5, 8]} intensity={3.0} color="#ff8844" distance={25} />
      <pointLight position={[14, 3.5, 26]} intensity={3.0} color="#ffaa66" distance={25} />
      <pointLight position={[38, 3.5, 28]} intensity={3.0} color="#88ff88" distance={25} />
      <pointLight position={[4, 3.5, 34]} intensity={2.0} color="#ff6666" distance={20} />

      {/* Ceiling lights - uniform overhead lighting */}
      <pointLight position={[10, 3.8, 16]} intensity={4.0} color="#ffffff" distance={20} />
      <pointLight position={[28, 3.8, 16]} intensity={3.0} color="#ffffff" distance={20} />
      <pointLight position={[40, 3.8, 30]} intensity={3.0} color="#ffffff" distance={20} />

      {/* Torch lights on walls - brighter */}
      <pointLight position={[6, 3, 4]} intensity={3.0} color="#ff8833" distance={15} />
      <pointLight position={[16, 3, 18]} intensity={3.0} color="#ff8833" distance={15} />
      <pointLight position={[30, 3, 12]} intensity={2.5} color="#ff8833" distance={15} />
      <pointLight position={[40, 3, 20]} intensity={2.5} color="#88cc88" distance={15} />
    </>
  );
}
