import logisticRegressionContent from '../posts/logistic-regression.md?raw'
import beirContent from '../posts/beir_freshstack.md?raw'
import chronicaContent from '../posts/cronica-de-uma-morte.md?raw'
import llmEvalsContent from '../posts/llm_evals.md?raw'
import mcpContent from '../posts/mcp.md?raw'
import newPostContent from '../posts/new-post.md?raw'
import promptrieverContent from '../posts/promptriever.md?raw'
import pylateContent from '../posts/pylate.md?raw'
import rank1Content from '../posts/RANK1.md?raw'
import representationsContent from '../posts/representations_of_data.md?raw'
import smolInvoiceContent from '../posts/smol-invoice-agent.md?raw'

export interface Post {
  slug: string
  title: string
  date: string
  description: string
  draft: boolean
  tags: string[]
  type: 'tech' | 'personal' | 'notes'
  content: string
  externalUrl?: string
}

function parseFrontmatter(raw: string): { meta: Record<string, unknown>; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { meta: {}, content: raw }

  const yamlBlock = match[1]
  const body = match[2]
  const meta: Record<string, unknown> = {}

  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const val = line.slice(colonIdx + 1).trim()
    if (!key) continue

    if (val.startsWith('[') && val.endsWith(']')) {
      meta[key] = val
        .slice(1, -1)
        .split(',')
        .map((v) => v.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    } else if (val === 'true') {
      meta[key] = true
    } else if (val === 'false') {
      meta[key] = false
    } else {
      meta[key] = val.replace(/^["']|["']$/g, '')
    }
  }

  return { meta, content: body }
}

function makePost(raw: string): Post {
  const { meta, content } = parseFrontmatter(raw)
  return {
    slug: (meta.slug as string) ?? '',
    title: (meta.title as string) ?? '',
    date: (meta.date as string) ?? '',
    description: (meta.description as string) ?? '',
    draft: (meta.draft as boolean) ?? false,
    tags: (meta.tags as string[]) ?? [],
    type: ((meta.type as string) === 'personal' ? 'personal' : (meta.type as string) === 'notes' ? 'notes' : 'tech'),
    content,
  }
}

const EXTERNAL_POSTS: Post[] = [
  {
    slug: 'glcms-ml-arsenal',
    title: 'GLCMs: A Great Tool for Your ML Arsenal',
    date: '2022-01-21',
    description: 'How Gray-Level Co-occurrence Matrices can boost your ML pipeline',
    draft: false,
    tags: ['ML', 'Computer Vision'],
    type: 'tech',
    content: '',
    externalUrl: 'https://medium.com/data-science/glcms-a-great-tool-for-your-ml-arsenal-7a59f1e45b65',
  },
  {
    slug: 'image-classification-web-app',
    title: 'How to Deploy a Fast and Scalable Image Classification Web App',
    date: '2023-02-06',
    description: 'Building and deploying an image classification app from scratch',
    draft: false,
    tags: ['ML', 'Deployment'],
    type: 'tech',
    content: '',
    externalUrl: 'https://medium.com/@mgrc99/how-to-deploy-a-fast-and-scalable-image-classification-web-app-538b1f43fb22',
  },
]

export const ALL_POSTS: Post[] = [
  makePost(logisticRegressionContent),
  makePost(beirContent),
  makePost(chronicaContent),
  makePost(llmEvalsContent),
  makePost(mcpContent),
  makePost(newPostContent),
  makePost(promptrieverContent),
  makePost(pylateContent),
  makePost(rank1Content),
  makePost(representationsContent),
  makePost(smolInvoiceContent),
  ...EXTERNAL_POSTS,
]
  .filter((p) => !p.draft)
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

export const TECH_POSTS = ALL_POSTS.filter((p) => p.type === 'tech')
export const PERSONAL_POSTS = ALL_POSTS.filter((p) => p.type === 'personal')
export const NOTES_POSTS = ALL_POSTS.filter((p) => p.type === 'notes')

export function getPostBySlug(slug: string): Post | undefined {
  return ALL_POSTS.find((p) => p.slug === slug)
}
