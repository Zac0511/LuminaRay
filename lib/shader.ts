
export const vertexShaderSource = `#version 300 es
in vec4 position;
void main() {
  gl_Position = position;
}
`;

interface ShaderConfig {
  maxSteps: number;
  maxBounces: number;
  shadowSteps: number;
}

export const getFragmentShaderSource = (config: ShaderConfig) => `#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;

uniform vec2 u_resolution;
uniform vec3 u_cameraPos;
uniform vec3 u_cameraDir;
uniform vec3 u_cameraUp;
uniform vec3 u_cameraRight;
uniform float u_time;
uniform bool u_showSphere;

uniform sampler3D u_grid; // 32x32x32 R8 texture
uniform vec3 u_palette[16]; // Colors

struct Light {
  vec3 position;
  vec3 color;
  float radius;
};
uniform Light u_lights[10];
uniform int u_lightCount;

out vec4 outColor;

const int MAX_STEPS = ${config.maxSteps};
const int MAX_BOUNCES = ${config.maxBounces};
const int SHADOW_STEPS = ${config.shadowSteps};

const float MAX_DIST = 100.0;
const float EPSILON = 0.001;
const int GRID_SIZE = 32;

// Sphere definition
const vec3 sphereCenter = vec3(16.0, 6.0, 16.0);
const float sphereRadius = 4.0;

// Helpers
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

// Ray-Sphere Intersection (Analytic for performance/cleanliness)
float intersectSphere(vec3 ro, vec3 rd, vec3 center, float radius) {
    vec3 oc = ro - center;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - radius * radius;
    float h = b * b - c;
    if (h < 0.0) return -1.0;
    return -b - sqrt(h);
}

// Voxel Traversal (DDA)
struct VoxelHit {
  float t;
  vec3 normal;
  int id; // 0 = air
};

VoxelHit intersectVoxels(vec3 ro, vec3 rd) {
    vec3 pos = floor(ro);
    vec3 signRd = sign(rd);
    vec3 step = signRd;
    vec3 tDelta = 1.0 / abs(rd);
    vec3 tMax = (signRd * (pos - ro + 0.5) + 0.5) * tDelta;

    vec3 normal = vec3(0.0);
    float t = 0.0;

    for (int i = 0; i < MAX_STEPS; i++) {
        if (pos.x < 0.0 || pos.x >= 32.0 ||
            pos.y < 0.0 || pos.y >= 32.0 ||
            pos.z < 0.0 || pos.z >= 32.0) {
            if(t > MAX_DIST) break;
        } else {
            vec3 uvw = (pos + 0.5) / 32.0;
            float val = texture(u_grid, uvw).r; 
            int id = int(val * 255.0 + 0.5);
            if (id > 0) {
                return VoxelHit(t, normal, id);
            }
        }

        if (tMax.x < tMax.y) {
            if (tMax.x < tMax.z) {
                t = tMax.x;
                tMax.x += tDelta.x;
                pos.x += step.x;
                normal = vec3(-step.x, 0.0, 0.0);
            } else {
                t = tMax.z;
                tMax.z += tDelta.z;
                pos.z += step.z;
                normal = vec3(0.0, 0.0, -step.z);
            }
        } else {
            if (tMax.y < tMax.z) {
                t = tMax.y;
                tMax.y += tDelta.y;
                pos.y += step.y;
                normal = vec3(0.0, -step.y, 0.0);
            } else {
                t = tMax.z;
                tMax.z += tDelta.z;
                pos.z += step.z;
                normal = vec3(0.0, 0.0, -step.z);
            }
        }
        if (t > MAX_DIST) break;
    }
    return VoxelHit(-1.0, vec3(0.0), 0);
}

// Optimized Shadow Trace (Returns boolean, no normal calc, fast exit)
bool traceShadow(vec3 ro, vec3 rd, float dist) {
    // Check sphere first (cheap analytic)
    if (u_showSphere) {
        float sT = intersectSphere(ro, rd, sphereCenter, sphereRadius);
        if (sT > 0.0 && sT < dist) return true;
    }

    vec3 pos = floor(ro);
    vec3 signRd = sign(rd);
    vec3 step = signRd;
    vec3 tDelta = 1.0 / abs(rd);
    vec3 tMax = (signRd * (pos - ro + 0.5) + 0.5) * tDelta;
    
    float t = 0.0;
    
    // Fewer steps for shadows (optimization)
    for (int i = 0; i < SHADOW_STEPS; i++) {
        if (t >= dist) return false;
        
        if (pos.x >= 0.0 && pos.x < 32.0 &&
            pos.y >= 0.0 && pos.y < 32.0 &&
            pos.z >= 0.0 && pos.z < 32.0) {
             // Texture fetch is the bottleneck usually, but unavoidable
             float val = texture(u_grid, (pos + 0.5) / 32.0).r;
             if (val > 0.0) return true;
        }

        if (tMax.x < tMax.y) {
            if (tMax.x < tMax.z) {
                t = tMax.x;
                tMax.x += tDelta.x;
                pos.x += step.x;
            } else {
                t = tMax.z;
                tMax.z += tDelta.z;
                pos.z += step.z;
            }
        } else {
            if (tMax.y < tMax.z) {
                t = tMax.y;
                tMax.y += tDelta.y;
                pos.y += step.y;
            } else {
                t = tMax.z;
                tMax.z += tDelta.z;
                pos.z += step.z;
            }
        }
    }
    return false;
}

struct SceneHit {
    float t;
    vec3 normal;
    int matID; // 1 = Voxel Diffuse, 2 = Sphere Mirror, 3 = Light, 4 = Voxel Mirror
    int colorID; // For voxels or lights
};

SceneHit map(vec3 ro, vec3 rd) {
    SceneHit hit;
    hit.t = MAX_DIST;
    hit.matID = 0;

    // 1. Check Voxels
    VoxelHit vHit = intersectVoxels(ro, rd);
    if (vHit.t > 0.0 && vHit.t < hit.t) {
        hit.t = vHit.t;
        hit.normal = vHit.normal;
        hit.matID = vHit.id == 100 ? 4 : 1; // 100 is Mirror Block
        hit.colorID = vHit.id;
    }

    // 2. Check Sphere
    if (u_showSphere) {
        float sT = intersectSphere(ro, rd, sphereCenter, sphereRadius);
        if (sT > 0.0 && sT < hit.t) {
            hit.t = sT;
            hit.normal = normalize((ro + rd * sT) - sphereCenter);
            hit.matID = 2;
        }
    }

    // 3. Check Lights (Visuals)
    for (int i = 0; i < 10; i++) {
        if (i >= u_lightCount) break;
        float lT = intersectSphere(ro, rd, u_lights[i].position, 0.15); // Light visual radius
        if (lT > 0.0 && lT < hit.t) {
             hit.t = lT;
             hit.normal = normalize((ro + rd * lT) - u_lights[i].position);
             hit.matID = 3;
             hit.colorID = i;
        }
    }

    return hit;
}

// Shading
vec3 getLighting(vec3 p, vec3 n, vec3 baseColor, float metallic) {
    vec3 finalColor = vec3(0.0);
    vec3 viewDir = normalize(u_cameraPos - p);
    
    // Ambient
    finalColor += baseColor * 0.1;

    for(int i=0; i<10; i++) {
        if (i >= u_lightCount) break;
        
        vec3 L = u_lights[i].position - p;
        float dist = length(L);
        L = normalize(L);
        
        // Optimization: Use traceShadow instead of full map
        // Start ray slightly offset to avoid self-intersection
        bool inShadow = traceShadow(p + n * 0.02, L, dist);
        
        if (!inShadow) {
            // Diffuse
            float diff = max(dot(n, L), 0.0);
            
            // Specular
            vec3 H = normalize(L + viewDir);
            float spec = pow(max(dot(n, H), 0.0), metallic > 0.5 ? 64.0 : 16.0);
            
            // Attenuation
            float att = 1.0 / (1.0 + 0.1 * dist + 0.01 * dist * dist);
            
            vec3 lightColor = u_lights[i].color;
            finalColor += (baseColor * diff + vec3(spec) * metallic) * lightColor * att * u_lights[i].radius;
        }
    }
    return finalColor;
}

void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
    
    // Camera Ray
    vec3 ro = u_cameraPos;
    vec3 rd = normalize(uv.x * u_cameraRight + uv.y * u_cameraUp + u_cameraDir);

    vec3 col = vec3(0.0);
    vec3 throughput = vec3(1.0);

    // Bounce Loop (Reflection)
    for (int bounce = 0; bounce < MAX_BOUNCES; bounce++) {
        SceneHit hit = map(ro, rd);
        
        if (hit.matID == 0) {
            // Background / Sky
            float t = 0.5 * (rd.y + 1.0);
            vec3 sky = mix(vec3(0.05, 0.05, 0.1), vec3(0.1, 0.1, 0.2), t);
            col += sky * throughput;
            break;
        }

        vec3 hitPos = ro + rd * hit.t;
        
        if (hit.matID == 2 || hit.matID == 4) {
            // Chrome Sphere (2) or Mirror Block (4)
            throughput *= vec3(0.9, 0.9, 0.95); 
            ro = hitPos + hit.normal * 0.001;
            rd = reflect(rd, hit.normal);
            // Add a little lighting contribution from the mirror surface itself (specular glow)
            col += getLighting(hitPos, hit.normal, vec3(0.0), 1.0) * throughput * 0.2;
        } else if (hit.matID == 3) {
             // Light Source Visual (Emissive)
             col += u_lights[hit.colorID].color * 2.0 * throughput; // Super bright
             break;
        } else {
            // Voxel (Diffuse)
            vec3 matColor = u_palette[hit.colorID - 1];
            // Fallback safety
            if(hit.colorID == 0) matColor = vec3(1.0, 0.0, 1.0); 
            col += getLighting(hitPos, hit.normal, matColor, 0.0) * throughput;
            break; 
        }
        
        // Optimization: kill ray if throughput is very low
        if (length(throughput) < 0.05) break;
    }

    // Gamma
    col = pow(col, vec3(0.4545));
    
    // Dither
    col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453) - 0.5) / 255.0;

    outColor = vec4(col, 1.0);
}
`;
