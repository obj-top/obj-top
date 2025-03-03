// @ts-ignore
import { defineConfig } from 'vite'
// @ts-ignore
import uni from '@dcloudio/vite-plugin-uni'
// @ts-ignore
import vue from '@vitejs/plugin-vue'

// @ts-ignore
export default defineConfig(({ mode }) => {
  // mode 参数即命令行传入的 --mode 值
  console.log('Current mode:', mode) // 输出 "adm"
  return {
    plugins: [uni(),vue,{
      name: 'modify-user-in-memory',
      transform(code: string, id: string | string[]) {
        if (id.includes('main.ts')&&mode=='adm'){
          return {
            //@ts-ignore
            code: code.replaceAll(/\bApp\b/g, 'AppAdm'),
            map: null // 不生成sourcemap
          }
        }
      }
    }],
  }
})
