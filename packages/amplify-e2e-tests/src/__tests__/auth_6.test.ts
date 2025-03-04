import { $TSAny } from '@aws-amplify/amplify-cli-core';
import {
  addAuthWithDefault,
  addAuthWithMaxOptions,
  amplifyOverrideAuth,
  amplifyPushAuth,
  amplifyPushOverride,
  createNewProjectDir,
  deleteProject,
  deleteProjectDir,
  getProjectMeta,
  getUserPool,
  initJSProjectWithProfile,
  replaceOverrideFileWithProjectInfo,
  runAmplifyAuthConsole,
} from '@aws-amplify/amplify-e2e-core';
import * as path from 'path';
import * as fs from 'fs-extra';

const PROJECT_NAME = 'authTest';
const defaultSettings = {
  name: PROJECT_NAME,
};
describe('zero config auth', () => {
  let projRoot: string;
  beforeEach(async () => {
    projRoot = await createNewProjectDir('zero-config-auth');
  });

  afterEach(async () => {
    await deleteProject(projRoot);
    deleteProjectDir(projRoot);
  });

  it('...should init a javascript project and add auth with all options and update front end config', async () => {
    await initJSProjectWithProfile(projRoot, defaultSettings);
    await addAuthWithMaxOptions(projRoot, {});
    await amplifyPushAuth(projRoot);

    const meta = getProjectMeta(projRoot);
    const authMeta: $TSAny = Object.values(meta.auth)[1];

    expect(authMeta.frontendAuthConfig).toMatchInlineSnapshot(`
      Object {
        "mfaConfiguration": "ON",
        "mfaTypes": Array [
          "SMS",
          "TOTP",
        ],
        "passwordProtectionSettings": Object {
          "passwordPolicyCharacters": Array [
            "REQUIRES_LOWERCASE",
            "REQUIRES_UPPERCASE",
            "REQUIRES_NUMBERS",
            "REQUIRES_SYMBOLS",
          ],
          "passwordPolicyMinLength": 8,
        },
        "signupAttributes": Array [
          "EMAIL",
        ],
        "socialProviders": Array [
          "FACEBOOK",
          "GOOGLE",
          "AMAZON",
          "APPLE",
        ],
        "usernameAttributes": Array [],
        "verificationMechanisms": Array [
          "EMAIL",
        ],
      }
    `);
  });

  it('...should init a project and add auth with defaults with overrides', async () => {
    await initJSProjectWithProfile(projRoot, defaultSettings);
    await addAuthWithDefault(projRoot);
    await amplifyPushAuth(projRoot);
    await runAmplifyAuthConsole(projRoot);
    const meta = getProjectMeta(projRoot);
    const authResourceName = Object.keys(meta.auth).filter((key) => meta.auth[key].service === 'Cognito');
    const id = Object.keys(meta.auth).map((key) => meta.auth[key])[0].output.UserPoolId;
    const userPool = await getUserPool(id, meta.providers.awscloudformation.Region);
    expect(userPool.UserPool).toBeDefined();

    // override new env
    await amplifyOverrideAuth(projRoot);

    // this is where we will write our override logic to
    const destOverrideFilePath = path.join(projRoot, 'amplify', 'backend', 'auth', `${authResourceName}`, 'override.ts');

    // test override file in compilation error state
    const srcInvalidOverrideCompileError = path.join(__dirname, '..', '..', 'overrides', 'override-compile-error.txt');
    fs.copyFileSync(srcInvalidOverrideCompileError, destOverrideFilePath);
    await expect(amplifyPushOverride(projRoot)).rejects.toThrowError();

    // test override file in runtime error state
    const srcInvalidOverrideRuntimeError = path.join(__dirname, '..', '..', 'overrides', 'override-runtime-error.txt');
    fs.copyFileSync(srcInvalidOverrideRuntimeError, destOverrideFilePath);
    await expect(amplifyPushOverride(projRoot)).rejects.toThrowError();

    // test happy path
    const srcOverrideFilePath = path.join(__dirname, '..', '..', 'overrides', 'override-auth.ts');
    replaceOverrideFileWithProjectInfo(srcOverrideFilePath, destOverrideFilePath, 'integtest', PROJECT_NAME);
    await amplifyPushOverride(projRoot);

    // check overwritten config
    const overwrittenUserPool = await getUserPool(id, meta.providers.awscloudformation.Region);
    expect(overwrittenUserPool.UserPool).toBeDefined();
    expect(overwrittenUserPool.UserPool.DeviceConfiguration.ChallengeRequiredOnNewDevice).toBe(true);
  });
});
