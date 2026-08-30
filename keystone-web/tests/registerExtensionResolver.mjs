import { register } from 'node:module'

register('./extensionResolver.mjs', import.meta.url)
