# IronLog PWA V1 上线前问题清单与修复指南

> 本文档详尽列出了 IronLog PWA 在 V1 发布前需要修复/优化的所有问题。
> 每个问题都包含：问题描述、涉及文件及行号、根因分析、具体修复方案（含伪代码/示例代码）、验收标准。
> 优先级：P0（必须修复）> P1（强烈建议）> P2（建议但不阻塞上线）。

---

## 目录

- [P0-1: 硬编码 Supabase 凭据 Fallback 应在生产构建中报错](#p0-1-硬编码-supabase-凭据-fallback-应在生产构建中报错)
- [P0-2: JWT 过期无自动刷新机制](#p0-2-jwt-过期无自动刷新机制)
- [P0-3: actionsValue 缺少 useMemo 导致不必要的重渲染](#p0-3-actionsvalue-缺少-usememo-导致不必要的重渲染)
- [P0-4: heic2any 包体积过大应改为按需动态加载](#p0-4-heic2any-包体积过大应改为按需动态加载)
- [P0-5: Edge Function CORS 配置过于宽松](#p0-5-edge-function-cors-配置过于宽松)
- [P1-1: package.json version 应设为 1.0.0](#p1-1-packagejson-version-应设为-100)
- [P1-2: Privy SDK 未按需裁剪 wallet/bridge 相关 chunks](#p1-2-privy-sdk-未按需裁剪-walletbridge-相关-chunks)
- [P1-3: WorkoutEditor.tsx 过大需要拆分](#p1-3-workouteditortsx-过大需要拆分)
- [P1-4: GymContext.tsx 过大，CRUD 操作存在大量重复模式](#p1-4-gymcontexttsx-过大crud-操作存在大量重复模式)
- [P1-5: fetchData 查询未分页](#p1-5-fetchdata-查询未分页)
- [P1-6: copyWorkout 未重新生成 exercise/set ID](#p1-6-copyworkout-未重新生成-exerciseset-id)
- [P2-1: Service Worker precache 范围过大](#p2-1-service-worker-precache-范围过大)
- [P2-2: 缺少生产环境错误监控](#p2-2-缺少生产环境错误监控)
- [P2-3: 测试覆盖不足](#p2-3-测试覆盖不足)
- [P2-4: GymContext useEffect 中 eslint-disable 可能引入闭包 bug](#p2-4-gymcontext-useeffect-中-eslint-disable-可能引入闭包-bug)
- [P2-5: PWA manifest start\_url 与 HashRouter 不匹配](#p2-5-pwa-manifest-start_url-与-hashrouter-不匹配)

---

## P0-1: 硬编码 Supabase 凭据 Fallback 应在生产构建中报错

### 问题描述

`src/services/auth.ts` 和 `src/services/supabase.ts` 中都硬编码了 Supabase URL 和 Anon Key 作为 fallback 默认值。当环境变量缺失时，应用会静默降级使用这些硬编码值，仅输出一条 `console.warn`，容易在部署时被忽略。

### 涉及文件及行号

| 文件 | 行号 | 内容 |
|------|------|------|
| `src/services/auth.ts` | 3-6 | `DEFAULT_SUPABASE_URL`, `DEFAULT_SUPABASE_ANON_KEY` 常量声明及 fallback 赋值 |
| `src/services/supabase.ts` | 3-12 | 同上，且包含 `console.warn` 提示 |

### 根因分析

开发阶段为了方便可以有默认值，但生产构建中如果环境变量缺失，说明部署配置有误。静默降级会导致：
1. 用户的数据可能连接到错误的 Supabase 实例
2. 部署人员无法立即发现配置遗漏
3. 硬编码的 key 如果泄露到公开仓库，可能被滥用（虽然 anon key 靠 RLS 保护）

### 修复方案

**方案 A（推荐）：在 Vite 构建中区分 dev/prod 行为**

在 `src/services/supabase.ts` 中：

```typescript
// 保留 DEFAULT 值仅用于 dev 模式
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || (
  import.meta.env.DEV
    ? 'https://gyiqdkmvlixwgedjhycc.supabase.co'
    : (() => { throw new Error('[IronLog] VITE_SUPABASE_URL is required in production'); })()
);

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || (
  import.meta.env.DEV
    ? 'sb_publishable_psIWS8xZmx4aCqVnzUFkyg_vjM1kPiz'
    : (() => { throw new Error('[IronLog] VITE_SUPABASE_ANON_KEY is required in production'); })()
);
```

对 `src/services/auth.ts` 做完全相同的修改（第 3-6 行）。

**要点：**
- `import.meta.env.DEV` 在 Vite dev server 下为 `true`，在 `vite build` 后为 `false`
- 生产构建中缺少环境变量会在模块加载时直接抛出错误，应用无法启动，部署人员可立即发现
- 删除 `supabase.ts` 第 8-12 行的 `console.warn` 块（不再需要）

### 验收标准

- [ ] 开发模式 (`npm run dev`) 下如果没有 `.env` 文件，应用仍可正常启动（使用默认值）
- [ ] 生产构建 (`npm run build && npm run preview`) 下如果没有设置环境变量，应用加载时在控制台抛出明确错误
- [ ] 两个文件中的 DEFAULT 常量保持一致（或提取到一个共享常量文件中）

---

## P0-2: JWT 过期无自动刷新机制

### 问题描述

Supabase Edge Function `token-exchange` 签发的 JWT 有效期为 1 小时（`supabase/functions/token-exchange/index.ts:71`，`expiresInSeconds = 3600`）。前端仅在 `initSession`（即用户首次登录/刷新页面）时调用一次 `exchangePrivyToken`。在用户持续使用超过 1 小时后，所有 Supabase 请求（workout CRUD、template 同步等）都会因 JWT 过期返回 401 错误，但没有任何自动刷新机制来续约。

### 涉及文件及行号

| 文件 | 行号 | 内容 |
|------|------|------|
| `supabase/functions/token-exchange/index.ts` | 71 | `const expiresInSeconds = 3600;` — JWT 有效期 1 小时 |
| `src/services/auth.ts` | 22-52 | `exchangePrivyToken` 函数，有缓存机制（5 分钟 buffer），但没有主动刷新调用 |
| `src/services/auth.ts` | 24-30 | 缓存判断：`Date.now() < cachedResult.expiresAt - 5 * 60 * 1000` |
| `src/context/GymContext.tsx` | 327-353 | `initSession` 函数 — 仅在认证初始化时调用一次 |
| `src/services/supabase.ts` | 29-38 | `setAuthToken` — 将 JWT 写入 Supabase client headers |

### 根因分析

`exchangePrivyToken` 内部有 token 缓存逻辑（在过期前 5 分钟内返回缓存），但这个缓存只是「被动」生效——只有在下次调用 `exchangePrivyToken` 时才会检查。问题是，在初始化 session 之后，**没有任何代码再次调用它**。

用户使用 app 超过 55 分钟后：
1. 旧 JWT 过期
2. 所有 Supabase 请求返回 401
3. 离线队列中的操作也无法同步
4. 用户不知道发生了什么（没有错误提示引导重新登录）

### 修复方案

在 `GymContext.tsx` 的 `GymProvider` 中添加一个 token 刷新定时器。

**步骤 1：在 `src/services/auth.ts` 中导出 `getTokenExpiresAt` 方法**

```typescript
/**
 * Get the current cached token's expiry timestamp (ms).
 * Returns null if no cached token exists.
 */
export function getTokenExpiresAt(): number | null {
  return cachedResult?.expiresAt ?? null;
}
```

**步骤 2：在 `GymContext.tsx` 中添加 token 刷新 useEffect**

在 `GymProvider` 组件内部（建议放在 `initSession` 函数之后，约第 354 行），添加一个新的 `useEffect`：

```typescript
import { exchangePrivyToken, getTokenExpiresAt, clearTokenCache } from '@/services/auth';
import { setAuthToken } from '@/services/supabase';

// Token refresh timer — runs when user is authenticated
useEffect(() => {
  if (!user?.id || E2E_BYPASS_AUTH) return;

  const scheduleRefresh = () => {
    const expiresAt = getTokenExpiresAt();
    if (!expiresAt) return;

    // Refresh 5 minutes before expiry
    const refreshAt = expiresAt - 5 * 60 * 1000;
    const delay = Math.max(0, refreshAt - Date.now());

    return window.setTimeout(async () => {
      try {
        // getAccessToken from Privy returns a fresh Privy token
        const privyToken = await getAccessToken();
        if (!privyToken) throw new Error('No Privy token available');

        clearTokenCache(); // Force fresh exchange
        const { token: newJwt } = await exchangePrivyToken(privyToken);
        setAuthToken(newJwt);
        // Schedule next refresh
        scheduleRefresh();
      } catch (error) {
        console.error('Token refresh failed:', error);
        // Optionally: show a toast prompting user to reload
        pushToast({ kind: 'error', message: 'Session expired. Please reload the page.' });
      }
    }, delay);
  };

  const timerId = scheduleRefresh();
  return () => {
    if (timerId) window.clearTimeout(timerId);
  };
}, [user?.id, getAccessToken]);
```

**要点：**
- `getAccessToken` 已经从 `usePrivy()` 解构出来（`GymContext.tsx:183`），可以直接使用
- 定时器在 `user.id` 变化时（登录/登出）自动清理和重建
- 刷新失败时给用户一个明确的提示
- `clearTokenCache()` 强制 `exchangePrivyToken` 发起新的网络请求而不是返回过期缓存

**步骤 3：增加 Privy `getIdentityToken` 作为 fallback**

在刷新逻辑中，如果 `getAccessToken()` 返回 null，可以尝试 `getIdentityToken()` 作为备选（与 `initSession` 中的 `exchangePrivyTokenWithRetry` 策略一致）。

### 验收标准

- [ ] 用户登录后，能在控制台/网络面板观察到大约每 55 分钟（3600 - 300 = 3300 秒）自动发起一次 `token-exchange` 请求
- [ ] 在 token 刷新前后连续执行 Supabase 操作（如添加 workout），不会出现 401 错误
- [ ] 刷新失败时，用户收到可见的 toast 提示
- [ ] 登出后定时器被正确清除（不会在登出状态下尝试刷新）
- [ ] E2E 测试模式（`VITE_E2E_BYPASS_AUTH=1`）下跳过刷新逻辑

---

## P0-3: actionsValue 缺少 useMemo 导致不必要的重渲染

### 问题描述

在 `GymContext.tsx` 第 994-1011 行，`actionsValue` 是一个普通对象字面量，没有用 `useMemo` 包裹。每当 `GymProvider` 因 state 变化重渲染时（比如 workouts 数组变化），`actionsValue` 都会创建一个新的对象引用。所有通过 `useContext(GymActionsContext)` 消费 actions 的组件都会触发不必要的重渲染——即使 actions 函数本身没有变化。

### 涉及文件及行号

| 文件 | 行号 | 内容 |
|------|------|------|
| `src/context/GymContext.tsx` | 985-992 | `dataValue` — 已正确使用 `useMemo` |
| `src/context/GymContext.tsx` | 994-1011 | `actionsValue` — **未使用 `useMemo`**，是一个普通对象 |

### 根因分析

`GymDataContext` 和 `GymActionsContext` 的拆分设计本意是让数据变化不影响只消费 actions 的组件。但因为 `actionsValue` 每次都是新引用，这个优化完全失效了。任何一个 state 变化（如 `workouts`、`exerciseDefs`、`templates`、`user`、`isLoading`）都会导致 **所有** 使用 `useGymActions()` 的组件重渲染。

### 修复方案

**步骤 1：将所有 action 函数用 `useCallback` 稳定化**

目前 `addWorkout`、`updateWorkout`、`deleteWorkout` 等函数引用了外部 state（如 `workouts`、`user`），导致它们无法被直接 memo。需要用 `useCallback` + functional state update 模式或使用 `useRef` 来持有最新值。

推荐使用 ref 模式（最小改动）：

```typescript
// 在 GymProvider 内部，约第 168 行附近
const userRef = useRef(user);
userRef.current = user;

const workoutsRef = useRef(workouts);
workoutsRef.current = workouts;

const exerciseDefsRef = useRef(exerciseDefs);
exerciseDefsRef.current = exerciseDefs;

const templatesRef = useRef(templates);
templatesRef.current = templates;
```

然后将 `addWorkout` 等函数中对 `user`、`workouts` 的直接引用改为 `userRef.current`、`workoutsRef.current`。这样函数可以用 `useCallback(fn, [])` 包裹且永不变化。

**步骤 2：用 `useMemo` 包裹 `actionsValue`**

```typescript
const actionsValue = useMemo<GymActionsContextType>(() => ({
  login,
  logout,
  toggleUnit,
  setRestTimerSeconds,
  setThemeMode,
  setNotificationsEnabled,
  addWorkout,
  updateWorkout,
  deleteWorkout,
  addExerciseDef,
  updateExerciseDef,
  deleteExerciseDef,
  addTemplateFromWorkout,
  deleteTemplate,
  startWorkoutFromTemplate,
  copyWorkout,
}), [
  login, logout, toggleUnit, setRestTimerSeconds, setThemeMode,
  setNotificationsEnabled, addWorkout, updateWorkout, deleteWorkout,
  addExerciseDef, updateExerciseDef, deleteExerciseDef,
  addTemplateFromWorkout, deleteTemplate, startWorkoutFromTemplate, copyWorkout,
]);
```

当所有 action 函数都通过 `useCallback` 稳定化后，这个依赖数组实际上不会变化，`actionsValue` 的引用就是稳定的。

**要点：**
- 这是一个渐进式修改：先加 ref + useCallback，再加 useMemo
- 修改后可以用 React DevTools Profiler 验证消费 actions 的组件不再因数据变化而重渲染
- `login` 和 `logout` 函数也需要 useCallback 包裹（它们引用了 `authenticated`、`privyUser` 等变量，可以用 ref 稳定化）

### 验收标准

- [ ] `actionsValue` 使用 `useMemo` 包裹
- [ ] 在 React DevTools Profiler 中：修改 workout 数据后，只消费 actions 的组件（如 `BottomNav`）不会出现在 "Rendered" 列表中
- [ ] 所有现有功能不受影响（workout CRUD、exercise CRUD、template、settings 等）
- [ ] TypeScript 类型检查通过 (`npm run typecheck`)
- [ ] 所有单元测试通过 (`npm run test`)

---

## P0-4: heic2any 包体积过大应改为按需动态加载

### 问题描述

构建产物中 `heic2any` 库生成了一个 **1,352 KB (gzip 341 KB)** 的独立 chunk (`heic2any-DHpaW2xH.js`)。这是整个应用最大的单个文件，超过了主 bundle (`index-CtRZEXnA.js`, 2,079 KB) 的一半。该库仅在用户上传 HEIC/HEIF 格式图片时才会用到（iOS 拍照默认格式），但目前它被包含在首屏加载的依赖链中。

### 涉及文件及行号

| 文件 | 行号 | 内容 |
|------|------|------|
| `src/services/utils.ts` | 162-169 | `heic2anyPromise` 变量和 `loadHeic2any` 函数 — 已实现动态 import |
| `src/services/utils.ts` | 313-324 | `processAndSaveMedia` 中调用 `loadHeic2any()` — 在 HEIC 文件时使用 |
| `package.json` | 21 | `"heic2any": "^0.0.4"` — 列在 dependencies 中 |
| `vite.config.ts` | 59-66 | `manualChunks` — 只拆分了 recharts，未处理 heic2any |

### 根因分析

检查代码发现 `src/services/utils.ts:162-169` **已经实现了动态 import 模式**：

```typescript
let heic2anyPromise: Promise<typeof import('heic2any')> | null = null;

const loadHeic2any = async () => {
  if (!heic2anyPromise) {
    heic2anyPromise = import('heic2any');
  }
  return heic2anyPromise;
};
```

且调用处 (`processAndSaveMedia` 第 314 行) 也是通过 `loadHeic2any()` 动态加载的。

**但是**，构建结果仍然显示 heic2any 被打包成一个 1.3MB 的 chunk 并出现在 precache 列表中（268 个文件，6,492 KB）。这意味着虽然 heic2any 不在首屏执行路径中，但 **Workbox service worker 仍然会预缓存它**，导致用户首次访问时需要下载这个大文件。

需要确认：
1. Vite 是否正确将 `import('heic2any')` 拆分为单独 chunk（从构建结果看已拆分）
2. 但 Workbox `globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']` 会将所有 JS 文件都加入 precache

### 修复方案

**步骤 1：从 Workbox precache 中排除 heic2any chunk**

在 `vite.config.ts` 中修改 Workbox 配置，排除 heic2any：

```typescript
// vite.config.ts 中 VitePWA 配置
VitePWA({
  registerType: 'autoUpdate',
  manifest: false,
  workbox: {
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    // 添加排除规则：排除 heic2any chunk
    globIgnores: ['**/heic2any*.js'],
    runtimeCaching: [
      // ...现有的 supabase-api 规则
      {
        urlPattern: /^https:\/\/gyiqdkmvlixwgedjhycc\.supabase\.co/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-api',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24,
          },
        },
      },
      // 为 heic2any 添加 runtime cache（CacheFirst 策略，用到时才缓存）
      {
        urlPattern: /heic2any.*\.js$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'heic2any-lazy',
          expiration: {
            maxEntries: 2,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 天
          },
        },
      },
    ],
  },
})
```

**步骤 2：验证动态 import 正常工作**

在构建完成后检查：
- `npm run build` 的输出中 `heic2any` 仍然是独立 chunk
- precache 列表中不再包含 heic2any 相关文件
- 总 precache 大小从 ~6.4MB 减少到 ~5.1MB

**步骤 3（可选优化）：考虑替代方案**

`heic2any` 库本身很大（1.3MB）是因为它内嵌了一个完整的 HEIF 解码器。如果用户群主要在 iOS 上使用且浏览器本身支持 HEIC 渲染，可以考虑：
- 先尝试直接 `compressImage(file)` 用 canvas 处理（现代 Safari 已支持 HEIC canvas 绘制）
- 仅当 canvas 失败时才 fallback 到 heic2any 转换
- 这样大部分 iOS 用户永远不需要加载 heic2any

### 验收标准

- [ ] `npm run build` 后 precache 条目数显著减少（不包含 heic2any chunk）
- [ ] precache 总大小从 ~6,492 KB 降低到 ~5,100 KB 左右
- [ ] 在 iOS 设备上传 HEIC 照片仍然正常工作（heic2any 按需加载）
- [ ] 在非 HEIC 文件上传场景中，网络面板中看不到 heic2any chunk 的请求
- [ ] Service worker 注册和更新正常

---

## P0-5: Edge Function CORS 配置过于宽松

### 问题描述

`supabase/functions/token-exchange/index.ts` 第 18 行的 CORS 配置设置了 `Access-Control-Allow-Origin: '*'`，允许任何域名调用 token exchange API。攻击者可以从任何网站发送请求到这个端点。

### 涉及文件及行号

| 文件 | 行号 | 内容 |
|------|------|------|
| `supabase/functions/token-exchange/index.ts` | 17-21 | `corsHeaders` 对象定义 |

### 根因分析

Token exchange 端点接收一个 Privy JWT 并返回一个 Supabase JWT。虽然攻击者需要有效的 Privy JWT 才能获取 Supabase JWT（因此风险有限），但宽松的 CORS 仍然增加了攻击面：
- 如果 Privy token 通过其他途径泄露（如浏览器插件、XSS），攻击者可以从任何域名进行 token 交换
- 不符合安全最佳实践

### 修复方案

将 `Access-Control-Allow-Origin` 限制为实际部署域名。

**方案 A（环境变量配置）：**

```typescript
// supabase/functions/token-exchange/index.ts

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(o => o.trim()).filter(Boolean);

// 如果未配置 ALLOWED_ORIGINS，仅在开发时允许 *
const getAllowedOrigin = (requestOrigin: string | null): string => {
  if (ALLOWED_ORIGINS.length === 0) return '*'; // dev fallback
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  return ALLOWED_ORIGINS[0]; // default to first allowed origin
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = {
    'Access-Control-Allow-Origin': getAllowedOrigin(origin),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  // ...其余逻辑不变，所有 Response 使用动态 corsHeaders
});
```

然后在 Supabase 部署时设置：
```bash
supabase secrets set ALLOWED_ORIGINS="https://your-production-domain.com,http://localhost:3000"
```

**要点：**
- 只有白名单中的域名才能调用 token-exchange
- 开发时如果未配置 `ALLOWED_ORIGINS`，回退到 `*`（便于本地开发）
- 每个 Response 都必须使用 `corsHeaders`（包括错误响应）

### 验收标准

- [ ] 从允许的域名发起的请求正常通过
- [ ] 从其他域名发起的请求被浏览器 CORS 策略阻止
- [ ] `OPTIONS` 预检请求正确返回 CORS headers
- [ ] 本地开发 (`localhost:3000`) 仍然可以正常调用
- [ ] `supabase secrets set ALLOWED_ORIGINS=...` 文档已更新到 README 或 .env.example

---

## P1-1: package.json version 应设为 1.0.0

### 问题描述

`package.json:4` 中 `version` 仍为 `"0.0.0"`。上线时应设置正式版本号，便于：
- 用户报 bug 时定位版本
- Service Worker 更新判断
- 未来的 changelog 追踪

### 涉及文件及行号

| 文件 | 行号 | 内容 |
|------|------|------|
| `package.json` | 4 | `"version": "0.0.0"` |

### 修复方案

```json
"version": "1.0.0"
```

同时考虑在应用 UI（如 Settings 页面或 About 区域）中显示版本号。可以在 `vite.config.ts` 中定义全局变量：

```typescript
// vite.config.ts defineConfig 中
define: {
  __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
},
```

然后在 `ProfileSettingsView.tsx` 底部显示：

```tsx
<p className="text-xs text-gray-400 text-center mt-4">v{__APP_VERSION__}</p>
```

并在 `src/vite-env.d.ts` 中添加类型声明：

```typescript
declare const __APP_VERSION__: string;
```

### 验收标准

- [ ] `package.json` version 为 `1.0.0`
- [ ] （可选）Settings 页面底部显示当前版本号

---

## P1-2: Privy SDK 未按需裁剪 wallet/bridge 相关 chunks

### 问题描述

构建产物中包含大量 Privy 相关的 wallet/bridge/crypto chunks，总计约 500KB+ gzip：

```
ConnectPhoneForm-***.js          162.85 kB │ gzip:  39.18 kB
SetWalletPasswordForm-***.js      90.91 kB │ gzip:  31.33 kB
w3m-modal-***.js                  81.61 kB │ gzip:  18.08 kB
BridgeNetworkSelectionView-***.js 68.92 kB │ gzip:  25.28 kB
ConnectWalletView-***.js          25.83 kB │ gzip:   8.38 kB
secp256k1-***.js                  34.30 kB │ gzip:  13.58 kB
```

如果应用只需要 Google 和 Email 登录，这些 wallet 相关代码是不必要的。

### 涉及文件及行号

| 文件 | 行号 | 内容 |
|------|------|------|
| `src/AppRoot.tsx` | (整个文件) | `PrivyProvider` 配置 |

### 修复方案

查看 `AppRoot.tsx` 中 `PrivyProvider` 的配置。Privy SDK 支持通过配置限制登录方式：

```tsx
<PrivyProvider
  appId={PRIVY_APP_ID}
  config={{
    loginMethods: ['google', 'email'],  // 只启用需要的登录方式
    appearance: {
      // ...
    },
    embeddedWallets: {
      createOnLogin: 'off',  // 禁止自动创建嵌入钱包
    },
  }}
>
```

**要点：**
- 需要先阅读 `AppRoot.tsx` 确认当前 Privy 配置
- 查阅 Privy SDK 文档确认 `loginMethods` 配置是否影响 tree-shaking
- 即使配置了 `loginMethods`，Privy SDK 内部可能仍然 import 了所有模块。如果 tree-shaking 无效，可以考虑在 `vite.config.ts` 的 `manualChunks` 中将这些模块独立拆分并从 precache 中排除（与 heic2any 相同策略）
- 如果确认用不到 wallet 登录，可以考虑在 `GymContext.tsx` 中移除 wallet 相关代码（第 373-380 行的 `evmWallet`/`solWallet` 查找逻辑）

### 验收标准

- [ ] 构建产物中 wallet/bridge 相关 chunks 尽可能减少或从 precache 中排除
- [ ] 登录流程仍然正常（Google、Email）
- [ ] 如果保留 wallet 登录选项，确保其仍可工作

---

## P1-3: WorkoutEditor.tsx 过大需要拆分

### 问题描述

`src/views/WorkoutEditor.tsx` 有 **1150 行**，是项目中最大的单一组件。包含：
- ~20 个 `useState` 声明（第 78-131 行）
- 完整的拖拽排序逻辑（第 105-576 行的 `ExerciseReorderState` 及相关函数）
- 计时器逻辑（第 210-222 行、274-288 行）
- 3 个 Modal（ExercisePicker、CreateExercise、EditExercise）
- 自动保存逻辑（第 230-258 行）
- 动画 & 报告逻辑（第 746-807 行）

这使得组件难以维护、测试和理解。

### 涉及文件及行号

| 文件 | 行范围 | 职责 |
|------|--------|------|
| `src/views/WorkoutEditor.tsx` | 105-576 | 拖拽排序（`ExerciseReorderState` 及 6 个相关函数） |
| `src/views/WorkoutEditor.tsx` | 210-222, 274-288 | 计时器逻辑 |
| `src/views/WorkoutEditor.tsx` | 230-258 | 自动保存 debounce 逻辑 |
| `src/views/WorkoutEditor.tsx` | 670-719 | 创建 exercise modal 逻辑 |
| `src/views/WorkoutEditor.tsx` | 604-620 | 编辑 exercise modal 逻辑 |
| `src/views/WorkoutEditor.tsx` | 959-1080 | 两个 Modal JSX（CreateExercise、EditExercise）|
| `src/views/WorkoutEditor.tsx` | 746-807 | 完成报告动画逻辑 |

### 修复方案

将 `WorkoutEditor.tsx` 拆分为以下模块：

**1. `src/hooks/useWorkoutTimer.ts`** — 计时器 hook

提取以下逻辑：
- `currentTime` state 和 timer interval（第 210-222 行）
- `toggleTimer` 函数（第 274-288 行）
- `formatDuration` 的调用

```typescript
// 签名参考
export function useWorkoutTimer(workout: Workout, dispatchWorkout: Dispatch<WorkoutAction>) {
  // ...返回 { currentTime, toggleTimer, durationMinutes }
}
```

**2. `src/hooks/useExerciseReorder.ts`** — 拖拽排序 hook

提取以下逻辑：
- `ExerciseReorderState` 类型定义（第 105-115 行）
- `exerciseReorder` state（第 117 行）
- 所有 ref（`cardRefs`, `reorderPendingRef`, `reorderTimerRef`, `reorderActiveRef`, `reorderRafRef`, `reorderLatestYRef`, `reorderAnimFromRef`）
- `startExerciseReorder`、`updateExerciseReorder`、`moveExerciseReorderPointer`、`finishExerciseReorder`、`endExerciseReorderPointer`、`cancelPendingReorder`、`captureReorderFromTops` 函数
- `useLayoutEffect` FLIP 动画（第 373-400 行）

```typescript
// 签名参考
export function useExerciseReorder(
  exercises: ExerciseInstance[],
  onReorder: (exercises: ExerciseInstance[]) => void,
) {
  // ...返回 { exerciseReorder, setCardRef, startExerciseReorder, moveExerciseReorderPointer, endExerciseReorderPointer, getCardStyle }
}
```

**3. `src/components/ExercisePickerModal.tsx`** — Exercise 选择 Modal

提取以下逻辑：
- `exPickerCategory` state
- `exDefsByCategory`、`filteredExerciseDefs` 的 useMemo
- Exercise picker Modal 的 JSX（第 959-1034 行）

```typescript
// 签名参考
interface ExercisePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (defId: string) => void;
  onEdit: (def: ExerciseDef) => void;
  onDelete: (def: ExerciseDef) => Promise<void>;
  onCreateNew: () => void;
  exerciseDefs: ExerciseDef[];
  workouts: Workout[];
}
```

**4. `src/components/CreateExerciseModal.tsx`** — 创建 Exercise Modal

提取以下 state 和逻辑：
- `newExName`、`newExDesc`、`newExCategory`、`newExUsesBarbell`、`newExBarbellWeight`、`mediaFile`、`isProcessing`
- `handleCreateExercise` 函数（第 670-719 行）
- Create exercise Modal 的 JSX（第 1036-1080 行）

**5. `src/components/EditExerciseModal.tsx`** — 编辑 Exercise Modal

提取以下 state 和逻辑：
- `editingExerciseId`、`editExName`、`editExDesc`、`editExCategory`、`editExUsesBarbell`、`editExBarbellWeight`
- `handleUpdateExercise` 函数（第 604-620 行）
- Edit exercise Modal 的 JSX（第 1082-1123 行）

### 拆分后 WorkoutEditor.tsx 结构

```tsx
const WorkoutEditor: React.FC = () => {
  // ~30 行 state & hooks
  const { currentTime, toggleTimer, durationMinutes } = useWorkoutTimer(workout, dispatchWorkout);
  const { exerciseReorder, setCardRef, ... } = useExerciseReorder(workout.exercises, handleReorder);

  // ~100 行 核心逻辑（autosave, addExercise, updateSet, addSet, deleteSet, finish, etc.）

  return (
    <div>
      {/* Header toolbar */}
      {/* Exercise cards list */}
      {/* Buttons */}
      <ExercisePickerModal ... />
      <CreateExerciseModal ... />
      <EditExerciseModal ... />
      <SessionReport ... />
      <RestTimer ... />
    </div>
  );
};
```

预期拆分后 `WorkoutEditor.tsx` 从 1150 行减少到 ~400 行。

### 验收标准

- [ ] `WorkoutEditor.tsx` 不超过 500 行
- [ ] 拆分出的每个文件有清晰的单一职责
- [ ] 所有现有功能不受影响（添加 exercise、拖拽排序、计时器、autosave、完成报告等）
- [ ] TypeScript 类型检查通过
- [ ] 单元测试通过

---

## P1-4: GymContext.tsx 过大，CRUD 操作存在大量重复模式

### 问题描述

`src/context/GymContext.tsx` 有 **1020 行**。其中 `addWorkout`（第 576-617 行）、`updateWorkout`（第 619-660 行）、`deleteWorkout`（第 662-689 行）三个函数几乎完全相同，只有 table 名、row 构造方式和 state setter 不同。`exerciseDef` 的增删改（第 691-802 行）和 `template` 的增删改也是同样模式。

每个 CRUD 操作的共同模式为：
1. 乐观更新 state
2. 尝试调用 Supabase
3. 如果失败且离线，入队 `syncQueue`
4. 如果失败且在线，回滚 state + 显示 toast

这个模式重复了 **8 次**（3 个 workout + 3 个 exerciseDef + 2 个 template 操作）。

### 涉及文件及行号

| 文件 | 行范围 | 重复模式 |
|------|--------|----------|
| `src/context/GymContext.tsx` | 576-617 | `addWorkout` |
| `src/context/GymContext.tsx` | 619-660 | `updateWorkout` |
| `src/context/GymContext.tsx` | 662-689 | `deleteWorkout` |
| `src/context/GymContext.tsx` | 691-731 | `addExerciseDef` |
| `src/context/GymContext.tsx` | 733-773 | `updateExerciseDef` |
| `src/context/GymContext.tsx` | 775-802 | `deleteExerciseDef` |
| `src/context/GymContext.tsx` | 810-853 | `addTemplate` (略有不同) |
| `src/context/GymContext.tsx` | 888-922 | `deleteTemplate` |

### 修复方案

提取一个通用的 `syncedMutation` 工具函数：

```typescript
// src/services/syncedMutation.ts

interface SyncedMutationOptions<T> {
  /** 乐观更新 state */
  optimisticUpdate: () => void;
  /** 回滚 state（网络失败时） */
  rollback: () => void;
  /** 执行 Supabase 操作 */
  remoteOperation: () => Promise<void>;
  /** 离线队列操作参数 */
  offlineQueueEntry: Omit<QueuedOperation, 'id' | 'timestamp'>;
  /** 失败 toast 消息 */
  errorMessage: string;
  /** 用户 ID */
  userId: string;
}

async function syncedMutation(options: SyncedMutationOptions): Promise<void> {
  const { optimisticUpdate, rollback, remoteOperation, offlineQueueEntry, errorMessage, userId } = options;

  // 1. 乐观更新
  optimisticUpdate();

  // 2. 尝试远程操作
  try {
    await retryWithBackoff(remoteOperation);
  } catch (error) {
    if (isOffline()) {
      // 3a. 离线 → 入队
      try {
        await enqueueSyncOperation(offlineQueueEntry);
        pushToast({ kind: 'info', message: OFFLINE_QUEUE_TOAST_MESSAGE });
      } catch (queueError) {
        rollback();
        pushToast({ kind: 'error', message: getErrorMessage(queueError, errorMessage) });
      }
    } else {
      // 3b. 在线但失败 → 回滚
      rollback();
      pushToast({ kind: 'error', message: getErrorMessage(error, errorMessage) });
    }
  }
}
```

使用示例（`addWorkout` 改造后）：

```typescript
const addWorkout = async (workout: Workout) => {
  if (!user || E2E_BYPASS_AUTH) {
    setWorkouts(prev => [...prev, workout]);
    return;
  }

  const row = buildWorkoutRow(workout, user.id);

  await syncedMutation({
    optimisticUpdate: () => setWorkouts(prev => [...prev, workout]),
    rollback: () => setWorkouts(prev => prev.filter(w => w.id !== workout.id)),
    remoteOperation: async () => {
      const { error } = await getSupabase().from('workouts').upsert(row);
      if (error) throw error;
    },
    offlineQueueEntry: { userId: user.id, table: 'workouts', action: 'upsert', payload: row },
    errorMessage: 'Failed to save workout',
    userId: user.id,
  });
};
```

同时提取 row 构造函数：

```typescript
const buildWorkoutRow = (workout: Workout, userId: string) => ({
  id: workout.id,
  user_id: userId,
  date: workout.date,
  title: workout.title,
  completed: workout.completed,
  data: {
    exercises: workout.exercises,
    note: workout.note,
    elapsedSeconds: workout.elapsedSeconds,
    startTimestamp: workout.startTimestamp,
  },
});

const buildExerciseDefRow = (def: ExerciseDef, userId: string) => ({
  id: def.id,
  user_id: userId,
  name: def.name,
  description: def.description,
  media_url: def.mediaUrl,
  media_type: def.mediaType,
  data: {
    category: def.category ?? 'Other',
    usesBarbell: !!def.usesBarbell,
    barbellWeight: def.barbellWeight,
  },
});
```

预期 `GymContext.tsx` 从 1020 行减少到 ~600 行。

### 验收标准

- [ ] CRUD 操作不再有重复的 try/catch + offline queue 模式
- [ ] `syncedMutation` 有独立的单元测试
- [ ] 所有现有功能不受影响
- [ ] TypeScript 类型检查通过

---

## P1-5: fetchData 查询未分页

### 问题描述

`GymContext.tsx` 第 419 行的 `fetchData` 函数调用 `getSupabase().from('workouts').select('*')` 获取用户所有历史 workout 数据。随着用户使用时间增长（假设每周 4 次训练，一年后有 ~200 条 workout，每条包含多个 exercises 和 sets 的嵌套 JSON），这个查询会越来越慢，且一次性加载所有数据到内存中会增加 JS heap 压力。

### 涉及文件及行号

| 文件 | 行号 | 内容 |
|------|------|------|
| `src/context/GymContext.tsx` | 419 | `getSupabase().from('workouts').select('*')` — 无 limit/分页 |
| `src/context/GymContext.tsx` | 420 | `getSupabase().from('exercise_defs').select('*')` — 也无分页，但量通常较小 |

### 修复方案

**阶段 1（V1 最小修改）：添加合理的 limit + 排序**

```typescript
// 只获取最近 6 个月的 workouts
const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
const cutoffDate = formatDate(sixMonthsAgo);

const [wResult, eResult, tResult] = await Promise.all([
  getSupabase()
    .from('workouts')
    .select('*')
    .gte('date', cutoffDate)
    .order('date', { ascending: false }),
  getSupabase().from('exercise_defs').select('*'),
  // ...templates 不变
]);
```

**阶段 2（V1.1 后续迭代）：按需加载历史数据**

1. `fetchData` 默认只加载最近 3 个月的数据
2. 在 `HistoryView` 中当用户滚动到底部或选择更早的年份筛选时，触发 `loadMoreWorkouts(offset, limit)` 加载更多
3. `StatsView` 中的统计图表按需查询聚合数据（而不是在前端遍历所有 workouts）

**要点：**
- `exercise_defs` 通常不会很多（几十条），不需要分页
- `workouts` 是增长最快的表，需要重点关注
- `formatDate` 函数在 `src/services/utils.ts:3-10` 中已存在

### 验收标准

- [ ] `fetchData` 中的 workouts 查询有 date 过滤条件或 limit
- [ ] 用户打开 app 后的首屏加载时间不会因历史数据量增长而显著变慢
- [ ] HistoryView 仍然能查看和筛选历史 workout（通过按需加载）
- [ ] StatsView 的图表数据仍然正确

---

## P1-6: copyWorkout 未重新生成 exercise/set ID

### 问题描述

`GymContext.tsx` 第 965-983 行的 `copyWorkout` 函数复制 workout 时，只为新的 workout 生成了新 ID (`generateId()`)，但 **exercise instance 和 set 的 ID 都被原样复制了**。这意味着数据库中会出现多个 workout 包含相同 ID 的 exercise 和 set。

### 涉及文件及行号

| 文件 | 行号 | 内容 |
|------|------|------|
| `src/context/GymContext.tsx` | 965-983 | `copyWorkout` 函数 |
| `src/context/GymContext.tsx` | 976-979 | exercise/set 复制逻辑 — `...ex` 和 `...s` 保留了原始 ID |

### 根因分析

当前代码：
```typescript
const newWorkout: Workout = {
  ...source,
  id: generateId(),        // ✅ 新 workout ID
  date: targetDate,
  completed: false,
  elapsedSeconds: 0,
  startTimestamp: null,
  exercises: source.exercises.map(ex => ({
    ...ex,                  // ❌ ex.id 未重新生成
    sets: ex.sets.map(s => ({
      ...s,                 // ❌ s.id 未重新生成
      completed: false
    })),
  })),
};
```

虽然当前数据模型中 exercise 和 set 是嵌套在 workout 的 `data` JSON 字段内（不是独立数据库行），所以**目前不会直接导致数据库冲突**。但重复 ID 可能导致：
1. 前端 React `key` 冲突（如果两个 workout 同时在列表中渲染）
2. PR 计算、统计等依赖 exercise ID 的逻辑出现混淆
3. 如果未来将 exercise/set 拆分为独立表，会直接导致 primary key 冲突

### 修复方案

```typescript
const copyWorkout = (workoutId: string, targetDate: string) => {
  const source = workouts.find(w => w.id === workoutId);
  if (!source) return;

  const newWorkout: Workout = {
    ...source,
    id: generateId(),
    date: targetDate,
    completed: false,
    elapsedSeconds: 0,
    startTimestamp: null,
    exercises: source.exercises.map(ex => ({
      ...ex,
      id: generateId(),           // ✅ 新 exercise instance ID
      sets: ex.sets.map(s => ({
        ...s,
        id: generateId(),         // ✅ 新 set ID
        completed: false,
      })),
    })),
  };

  void addWorkout(newWorkout);
};
```

同样检查 `startWorkoutFromTemplate`（第 924-963 行）—— 这个函数已经正确使用 `generateId()` 为每个 exercise 和 set 生成新 ID（第 935-941 行），所以不需要修改。

### 验收标准

- [ ] 复制后的 workout 中每个 exercise 和 set 都有唯一的新 ID
- [ ] 原始 workout 的数据不受影响
- [ ] 复制后的 workout 可以正常编辑、保存、完成

---

## P2-1: Service Worker precache 范围过大

### 问题描述

当前 Workbox 配置 `globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']` 将所有构建产物都加入 precache，产生了 268 个条目、总计 6,492 KB。这意味着用户首次访问时 Service Worker 会在后台下载所有这些文件，对移动网络不友好。

### 涉及文件及行号

| 文件 | 行号 | 内容 |
|------|------|------|
| `vite.config.ts` | 21 | `globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']` |

### 修复方案

将 precache 范围缩小到核心 shell 文件，其余使用 runtime caching：

```typescript
workbox: {
  // ...其他配置不变
  // 只 precache 核心 HTML、CSS 和主 JS bundle
  globPatterns: ['**/*.{html,css,ico}', 'assets/index-*.js'],
  // 排除大型懒加载 chunks
  globIgnores: [
    '**/heic2any*.js',
    '**/charts-vendor*.js',    // recharts 只在 StatsView 用到
    '**/ConnectPhone*.js',     // Privy wallet 相关
    '**/SetWalletPassword*.js',
    '**/BridgeNetwork*.js',
    '**/w3m-modal*.js',
    '**/ConnectWallet*.js',
  ],
  runtimeCaching: [
    // 已有的 supabase-api 规则...
    {
      // 懒加载的 JS chunks — 用到时才缓存
      urlPattern: /\.js$/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'js-chunks',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 7,  // 7 天
        },
      },
    },
  ],
}
```

### 验收标准

- [ ] precache 条目数从 268 减少到 <50
- [ ] precache 总大小从 ~6.4MB 减少到 <2MB
- [ ] 应用离线模式下核心功能仍然可用（Dashboard、WorkoutEditor）
- [ ] StatsView（recharts）在离线时首次访问会显示加载失败提示（可接受）

---

## P2-2: 缺少生产环境错误监控

### 问题描述

项目中没有集成任何错误监控服务（如 Sentry、LogRocket、Bugsnag）。虽然有 `AppErrorBoundary.tsx`（`src/components/AppErrorBoundary.tsx`）捕获渲染错误，但它只在 UI 上显示错误信息，不会上报到任何外部服务。上线后如果用户遇到 bug（尤其是移动端特定问题），开发者无法主动发现。

### 涉及文件及行号

| 文件 | 行号 | 内容 |
|------|------|------|
| `src/components/AppErrorBoundary.tsx` | (整个文件) | React Error Boundary，仅本地渲染错误 |

### 修复方案

推荐集成 Sentry（有免费额度，PWA 友好）：

**步骤 1：安装 Sentry**
```bash
npm install @sentry/react
```

**步骤 2：在 `src/index.tsx` 中初始化**
```typescript
import * as Sentry from '@sentry/react';

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    release: __APP_VERSION__,  // 来自 P1-1 的版本号
    environment: 'production',
    tracesSampleRate: 0.1,     // 10% 性能采样
  });
}
```

**步骤 3：在 `AppErrorBoundary.tsx` 中上报错误**
```typescript
componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
}
```

**步骤 4：在 `.env.example` 中添加**
```
VITE_SENTRY_DSN=your-sentry-dsn-here
```

### 验收标准

- [ ] 生产环境中 unhandled rejection 和 React 渲染错误被自动上报
- [ ] Sentry dashboard 中能看到错误记录（附带版本号、用户浏览器信息、Stack trace）
- [ ] 开发环境不触发 Sentry 上报
- [ ] Sentry SDK 包大小在可接受范围内（~30KB gzip）

---

## P2-3: 测试覆盖不足

### 问题描述

项目目前只有 4 个测试文件、13 个测试用例：

| 测试文件 | 测试数 | 覆盖范围 |
|----------|--------|----------|
| `src/services/auth.test.ts` | 4 | `privyDidToUuid` 函数 |
| `src/services/utils.test.ts` | 4 | `formatDate`、`formatDuration` 等工具函数 |
| `src/context/GymContext.test.tsx` | 2 | GymProvider 基本渲染 |
| `src/components/ui.test.tsx` | 3 | Button、Input 基本渲染 |

**缺失的关键测试：**
- Workout CRUD（add/update/delete）的完整流程
- 离线同步队列（enqueue/dequeue/consume）
- Token 缓存与刷新逻辑
- `processAndSaveMedia` 中的 HEIC 检测和 fallback 逻辑
- `copyWorkout`、`startWorkoutFromTemplate` 的数据变换正确性
- PR 计算逻辑（`src/services/pr.ts`）
- 导出功能（`src/services/export.ts`）

### 修复方案

按优先级添加以下测试：

**高优先级：**

1. **`src/services/syncQueue.test.ts`** — 测试 `enqueueSyncOperation`、`listQueuedOperations`、`removeQueuedOperation`
   - 需要 mock IndexedDB（使用 `fake-indexeddb` npm 包）
   - 测试：入队 → 列出 → 按 userId 过滤 → 移除 → 列表为空

2. **`src/services/pr.test.ts`** — 测试 `calculatePRs` 和 `calculateBrokenPRs`
   - 构造包含不同 weight/reps 的 workouts
   - 验证 PR 计算（1RM 公式）正确性

3. **`src/services/export.test.ts`** — 测试 CSV/JSON 导出
   - 验证 CSV escape 正确性（特殊字符、逗号、引号）
   - 验证 JSON 结构完整性

**中优先级：**

4. **`src/context/GymContext.test.tsx` 扩展** — 测试 CRUD 操作
   - Mock Supabase client
   - 测试 addWorkout → state 更新 → Supabase 被调用
   - 测试 offline 模式 → queue 被使用

5. **`src/services/auth.test.ts` 扩展** — 测试 token 缓存逻辑
   - 测试缓存命中（同一 token，未过期）
   - 测试缓存失效（过期/不同 token）

### 验收标准

- [ ] 测试用例数从 13 增加到至少 30
- [ ] 核心业务逻辑（CRUD、PR、export、syncQueue）都有测试覆盖
- [ ] `npm run test` 全部通过
- [ ] 不引入新的 dev dependencies（`fake-indexeddb` 除外）

---

## P2-4: GymContext useEffect 中 eslint-disable 可能引入闭包 bug

### 问题描述

`GymContext.tsx` 第 275-276 行禁用了 `react-hooks/exhaustive-deps` 规则：

```typescript
// initSession intentionally reads latest auth state from current closure.
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [ready, authenticated, privyUser, user]);
```

依赖数组中列出了 `ready`、`authenticated`、`privyUser`、`user`，但 `initSession` 函数内部还引用了 `getAccessToken`、`consumeSyncQueue`、`privyUser` 等变量。如果这些变量发生变化但 effect 没有重新执行，可能导致使用过期闭包中的引用。

### 涉及文件及行号

| 文件 | 行号 | 内容 |
|------|------|------|
| `src/context/GymContext.tsx` | 249-276 | 认证初始化 useEffect |
| `src/context/GymContext.tsx` | 294-353 | `initSession` 函数 — 使用了大量外部变量 |

### 修复方案

**方案 A（推荐）：用 ref 持有 initSession 需要的变量**

```typescript
const getAccessTokenRef = useRef(getAccessToken);
getAccessTokenRef.current = getAccessToken;

const privyUserRef = useRef(privyUser);
privyUserRef.current = privyUser;

const consumeSyncQueueRef = useRef(consumeSyncQueue);
consumeSyncQueueRef.current = consumeSyncQueue;
```

然后在 `initSession` 中使用 `getAccessTokenRef.current()` 代替 `getAccessToken()`，这样 `initSession` 总是能访问最新的引用，无需将它们加入依赖数组。

**方案 B：将 `initSession` 改为 `useCallback` + 正确的依赖**

将 `initSession` 用 `useCallback` 包裹，并将其加入 useEffect 的依赖数组。需要仔细管理其所有依赖。

**要点：**
- 当前代码的注释 "intentionally reads latest auth state from current closure" 说明作者意识到了这个问题并选择了 eslint-disable
- 方案 A 更安全，因为 ref 总是指向最新值，不依赖闭包
- 修改后可以移除 `eslint-disable` 注释

### 验收标准

- [ ] 移除 `eslint-disable-next-line react-hooks/exhaustive-deps` 注释
- [ ] `npm run lint` 无新的 warnings
- [ ] 认证流程仍然正常（登录、登出、token 交换）
- [ ] 快速切换用户（登出再登入另一个账号）不会出现数据混乱

---

## P2-5: PWA manifest start_url 与 HashRouter 不匹配

### 问题描述

`public/manifest.webmanifest` 中 `start_url` 设置为 `"/"`：

```json
{
  "start_url": "/",
  "scope": "/"
}
```

但应用使用的是 `HashRouter`（`src/App.tsx:157`），这意味着所有路由都在 `#` 后面（如 `/#/calendar`、`/#/workout/123`）。当用户从 iOS/Android 主屏幕启动 PWA 时，`start_url: "/"` 会加载 `index.html`，然后 HashRouter 默认路由到 `/#/`（Dashboard）。这通常能工作，但有以下潜在问题：

1. 某些 PWA 审计工具（如 Lighthouse）会标记 `start_url` 与实际路由不一致
2. 如果用户深链接到特定页面（如通过分享链接），hash 路由的行为可能不一致

### 涉及文件及行号

| 文件 | 行号 | 内容 |
|------|------|------|
| `public/manifest.webmanifest` | 4-5 | `"start_url": "/"` 和 `"scope": "/"` |
| `src/App.tsx` | 157 | `<HashRouter>` |

### 修复方案

将 manifest 中的 `start_url` 改为包含 hash：

```json
{
  "start_url": "/#/",
  "scope": "/"
}
```

`scope` 保持 `"/"` 不变（因为 hash 不影响 scope 判断）。

**替代方案（长期）：**
考虑将 `HashRouter` 迁移到 `BrowserRouter`。这需要服务器端配置（所有路径都返回 `index.html`），但对 SEO 和 PWA 兼容性更好。大多数现代托管平台（Vercel、Netlify、Cloudflare Pages）都支持 SPA fallback。

### 验收标准

- [ ] `manifest.webmanifest` 中 `start_url` 设为 `"/#/"`
- [ ] 从主屏幕启动 PWA 正确导航到 Dashboard
- [ ] Lighthouse PWA 审计中 manifest 相关项全部通过

---

## 附录：项目文件结构参考

```
src/
├── components/
│   ├── ui.tsx                    (729 行 — UI 基础组件库)
│   ├── ExerciseCard.tsx          (217 行)
│   ├── RestTimer.tsx             (221 行)
│   ├── WorkoutReportCanvas.tsx   (197 行)
│   ├── BottomNav.tsx             (74 行)
│   ├── AnimatedRoutes.tsx        (61 行)
│   ├── AppErrorBoundary.tsx      (56 行)
│   ├── SessionReport.tsx         (106 行)
│   └── ...其他组件
├── context/
│   └── GymContext.tsx            (1020 行 — 需要拆分)
├── hooks/
│   ├── useGym.ts
│   ├── useGymData.ts
│   ├── useGymActions.ts
│   └── useConfirm.tsx
├── services/
│   ├── auth.ts                   (86 行)
│   ├── supabase.ts               (65 行)
│   ├── syncQueue.ts              (100 行)
│   ├── utils.ts                  (352 行)
│   ├── export.ts                 (68 行)
│   ├── pr.ts
│   └── notifications.ts          (29 行)
├── views/
│   ├── WorkoutEditor.tsx         (1150 行 — 需要拆分)
│   ├── HistoryView.tsx           (451 行)
│   ├── StatsView.tsx             (355 行)
│   ├── Dashboard.tsx             (219 行)
│   ├── CalendarView.tsx          (255 行)
│   ├── ProfileSettingsView.tsx   (191 行)
│   ├── ProfileView.tsx           (73 行)
│   └── LoginView.tsx             (71 行)
├── i18n/
│   ├── I18nProvider.tsx
│   ├── useI18n.ts
│   ├── en.json
│   └── zh.json
├── types.ts                      (67 行)
├── constants.ts
├── App.tsx                       (167 行)
├── AppRoot.tsx
├── index.tsx
└── index.css
```
