import type { CSSProperties, ReactNode } from 'react'

interface AppPageFrameProps {
  children: ReactNode
  frameStyle?: CSSProperties
  contentStyle?: CSSProperties
}

const viewportStyle: CSSProperties = {
  height: '100%',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const frameBaseStyle: CSSProperties = {
  flex: '1 1 0',
  minHeight: 0,
  overflow: 'hidden',
  padding: '2rem',
  boxSizing: 'border-box',
}

const contentBaseStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
}

export function AppPageFrame({
  children,
  frameStyle,
  contentStyle,
}: AppPageFrameProps) {
  return (
    <div style={viewportStyle}>
      <div style={{ ...frameBaseStyle, ...frameStyle }}>
        <div style={{ ...contentBaseStyle, ...contentStyle }}>
          {children}
        </div>
      </div>
    </div>
  )
}
