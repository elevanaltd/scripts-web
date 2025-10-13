import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App Component', () => {
  it('renders without crashing', () => {
    render(<App />)
    // App should render without throwing an error
    // In this case, the loading state is displayed due to authentication
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    render(<App />)
    // Since we're not authenticated in tests, we should see the loading state
    const loadingElement = screen.getByText('Loading...')
    expect(loadingElement).toBeInTheDocument()
  })
})