#include "Model/World.h"

World::World() {
    sunLightDirection = glm::vec3(1.0f, 0.3f, 0.0f);
    shadowMappingShader = new Shader("ShadowMappingVert.vs", "ShadowMappingFrag.frag");
    modelShader = new Shader("ModelVert.vs", "ModelFrag.frag");

    camera = new Camera();
    loadDepthMap();
}

/**
 * @brief 生成深度贴图
*/
void World::loadDepthMap() {
    
    // 创建帧缓冲对象
    glGenFramebuffers(1, &depthMapFBO);

    // 创建2D纹理
    unsigned int depthMap;
    glGenTextures(1, &depthMap);
    glBindTexture(GL_TEXTURE_2D, depthMap);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_DEPTH_COMPONENT, SHADOW_WIDTH, SHADOW_HEIGHT, 0, GL_DEPTH_COMPONENT, GL_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
    
    // 创建帧缓冲并绑定深度贴图
    glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, depthMap, 0);
    glDrawBuffer(GL_NONE);
    glReadBuffer(GL_NONE);
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
}

/**
 * @brief 计算光空间转换矩阵
*/
void World::calculateLightSpaceMatrix() {
    glm::mat4 lightProjection, lightView;
    float near_plane = 1.0f, far_plane = 7.5f;
    lightProjection = glm::ortho(-10.0f, 10.0f, -10.0f, 10.0f, near_plane, far_plane);
    lightView = glm::lookAt(sunLightDirection, glm::vec3(0.0f), glm::vec3(0.0, 1.0, 0.0));
    lightSpaceMatrix = lightProjection * lightView;
}

/**
 * @brief 渲染深度贴图
*/
void World::renderDepthMap() {
    // 计算光空间转换矩阵
    calculateLightSpaceMatrix();

    // 设置着色器
    shadowMappingShader->use();
    shadowMappingShader->setMat4("lightSpaceMatrix", lightSpaceMatrix);

    // 渲染深度贴图
    glViewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT);
    glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
    renderObjects(shadowMappingShader);
    glBindFramebuffer(GL_FRAMEBUFFER, 0);        
}

/**
 * @brief 完整的渲染
*/
void World::render() {
    // 重置视口
    glViewport(0, 0, SCR_WIDTH, SCR_HEIGHT);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    // 使用深度贴图渲染场景
    glViewport(0, 0, SCR_WIDTH, SCR_HEIGHT);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    modelShader->use();
    glm::mat4 projection = glm::perspective(glm::radians(camera->Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
    glm::mat4 view = camera->GetViewMatrix();

    // 传递Uniform数据
    modelShader->setMat4("model", glm::mat4(1.0f));
    modelShader->setMat4("view", view);
    modelShader->setMat4("projection", projection);
    modelShader->setMat4("lightSpaceMatrix", lightSpaceMatrix);

    modelShader->setVec3("viewPos", camera->Position);
    modelShader->setVec3("direction_light.direction", sunLightDirection);
    modelShader->setVec3("direction_light.ambient", glm::vec3(0.1f, 0.1f, 0.1f));
    modelShader->setVec3("direction_light.diffuse", glm::vec3(0.5f, 0.5f, 0.5f));
    modelShader->setVec3("direction_light.specular", glm::vec3(0.7f, 0.7f, 0.7f));

    // 绘制场景
    renderObjects(modelShader);
}

/**
 * @brief 渲染世界中的所有模型
 * @param shader 渲染使用的着色器
*/
void World::renderObjects(const Shader* shader) {
    // to-do
}

World::~World() {
    delete shadowMappingShader;
    delete modelShader;
}