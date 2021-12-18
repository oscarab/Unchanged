#version 330 core

struct PointLight {
    vec3 position;
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};
struct DirectionalLight {
    vec3 direction;     // 平行光方向
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};
struct SpotLight {
    vec3 position;      // 光源位置
    vec3  direction;    // 光源照的方向
    float cutOff;       // 内圈角度
    float outerCutOff;  // 外圈角度

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;

    float constant;
    float linear;
    float quadratic;
};
uniform PointLight point_light;             // 点光源
uniform DirectionalLight direction_light;   // 平行光源
uniform SpotLight spot_light;               // 聚光
uniform vec3 viewPos;                       // 观察者位置

out vec4 FragColor;

in vec3 Normal;                     // 法向量
in vec3 FragPos;                    // 片段坐标
in vec2 TexCoords;                  // 纹理坐标
in vec4 FragDirectSpacePos;         // 片段位于平行光空间的坐标
in vec4 FragSpotSpacePos;           // 片段位于聚光空间的坐标

uniform sampler2D texture_diffuse1;     // 漫反射贴图
uniform sampler2D texture_specular1;    // 高光贴图
uniform sampler2D texture_shadowMap1;   // 深度贴图
uniform sampler2D texture_shadowMap2;   // 深度贴图

uniform samplerCube texture_shadowMap3;
uniform float far_plane;

float caculateShadow(vec3 lightDir, vec4 FragLightSpacePos, sampler2D texture_shadowMap) {
    // 获取采样坐标
    vec3 projCoords = FragLightSpacePos.xyz / FragLightSpacePos.w;
    projCoords = projCoords * 0.5 + 0.5;

    // 比对当前片段深度与深度贴图上的深度值
    float closestDepth = texture(texture_shadowMap, projCoords.xy).r;
    float currentDepth = projCoords.z;

    float shadow = 0.0;
    vec2 texelSize = 1.0 / textureSize(texture_shadowMap, 0);
    for(int x = -2; x <= 2; ++x) {
        for(int y = -2; y <= 2; ++y) {
            float pcfDepth = texture(texture_shadowMap, projCoords.xy + vec2(x, y) * texelSize).r; 
            shadow += currentDepth > pcfDepth  ? 1.0 : 0.0;
        }
    }
    shadow /= 25.0;
    if(projCoords.z > 1.0)
        shadow = 0.0;

    return shadow;
}

// 计算点光源
vec3 getPointLight() {
    vec3 model_diffuse = vec3(texture(texture_diffuse1, TexCoords));
    vec3 model_specular = vec3(texture(texture_specular1, TexCoords));

    // 漫反射
    vec3 normal = normalize(Normal);
    vec3 lightDir = normalize(point_light.position - FragPos);
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = point_light.diffuse * (diff * model_diffuse);

    // 镜面高光
    vec3 viewDir = normalize(viewPos - FragPos);
    vec3 halfwayDir = normalize(lightDir + viewDir);  
    float spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0f);
    vec3 specular = point_light.specular * (spec * model_specular);

    //计算阴影
    vec3 lightColor = vec3(3.5);
    vec3 fragToLight = FragPos - point_light.position;
    float closestDepth = texture(texture_shadowMap3, fragToLight).r;
    closestDepth *= far_plane;
    float currentDepth = length(fragToLight);
    float bias = 0.05; 
    float shadow = currentDepth -  bias > closestDepth ? 1.0 : 0.0;
    return lightColor * (1.0 - shadow) * (diffuse + specular);
}

// 计算平行光
vec3 getDirectionLight() {
    vec3 model_diffuse = vec3(texture(texture_diffuse1, TexCoords));
    vec3 model_specular = vec3(texture(texture_specular1, TexCoords));

    // 漫反射
    vec3 normal = normalize(Normal);
    vec3 lightDir = normalize(direction_light.direction);
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = direction_light.diffuse * (diff * model_diffuse);

    // 镜面高光
    vec3 viewDir = normalize(viewPos - FragPos);
    vec3 halfwayDir = normalize(lightDir + viewDir);  
    float spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0f);
    vec3 specular = direction_light.specular * (spec * model_specular);

    // 计算阴影
    float shadow = (1.0 - caculateShadow(lightDir, FragDirectSpacePos, texture_shadowMap1));

    return shadow * (diffuse + specular);
}

// 计算聚光
vec3 getSpotLight() {
    vec3 model_diffuse = vec3(texture(texture_diffuse1, TexCoords));
    vec3 model_specular = vec3(texture(texture_specular1, TexCoords));

    vec3 lightDir = normalize(spot_light.position - FragPos);
    float theta = dot(lightDir, normalize(-spot_light.direction));
    float epsilon = spot_light.cutOff - spot_light.outerCutOff;
    float intensity = clamp((theta - spot_light.outerCutOff) / epsilon, 0.0, 1.0);    
      
    // 漫反射
    vec3 normal = normalize(Normal);
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = spot_light.diffuse * (diff * model_diffuse);

    // 镜面高光
    vec3 viewDir = normalize(viewPos - FragPos);
    vec3 halfwayDir = normalize(lightDir + viewDir);  
    float spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0f);
    vec3 specular = spot_light.specular * (spec * model_specular);

    // 计算阴影
    float shadow = (1.0 - caculateShadow(lightDir, FragSpotSpacePos, texture_shadowMap2));

    // 计算衰减
    float distance    = length(spot_light.position - FragPos);
    float attenuation = 1.0 / (spot_light.constant + spot_light.linear * distance + 
                spot_light.quadratic * (distance * distance));

    return attenuation * shadow * (diffuse * intensity + specular * intensity);
}

void main()
{    
    vec3 model_diffuse = vec3(texture(texture_diffuse1, TexCoords));
    // 环境光
    vec3 ambient = direction_light.ambient * model_diffuse;

    vec3 result = ambient + getDirectionLight() + getSpotLight() + getPointLight();

    FragColor = vec4(result, 1.0f);

    

}