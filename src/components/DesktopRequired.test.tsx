/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DesktopRequired } from './DesktopRequired'

describe('DesktopRequired', () => {
  describe('Professional Mobile Fallback', () => {
    it('should render desktop required message', () => {
      render(<DesktopRequired />)

      expect(screen.getByText('Desktop Required')).toBeInTheDocument()
      expect(screen.getByText(/EAV Orchestrator is designed for video production workflows/)).toBeInTheDocument()
    })

    it('should explain why desktop is required', () => {
      render(<DesktopRequired />)

      expect(screen.getByText('Why Desktop?')).toBeInTheDocument()
      expect(screen.getByText(/Rich Text Editing/)).toBeInTheDocument()
      expect(screen.getByText(/Multi-Tab Workflow/)).toBeInTheDocument()
      expect(screen.getByText(/Collaborative Comments/)).toBeInTheDocument()
      expect(screen.getByText(/Professional Tools/)).toBeInTheDocument()
    })

    it('should show access options', () => {
      render(<DesktopRequired />)

      expect(screen.getByText('Access Options')).toBeInTheDocument()
      expect(screen.getByText('🖥️ Desktop Computer')).toBeInTheDocument()
      expect(screen.getByText('💻 Laptop')).toBeInTheDocument()
      expect(screen.getByText('📱 Mobile (Limited)')).toBeInTheDocument()
    })

    it('should have professional styling and layout', () => {
      const { container } = render(<DesktopRequired />)

      const requiredContainer = screen.getByText('Desktop Required').closest('.desktop-required-container')
      expect(requiredContainer).toBeInTheDocument()

      // SVG doesn't have role="img" by default - query directly
      const icon = container.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })

    it('should mention future mobile features', () => {
      render(<DesktopRequired />)

      expect(screen.getByText('Feature in development')).toBeInTheDocument()
      expect(screen.getByText(/View-only access for reviewing scripts/)).toBeInTheDocument()
    })

    it('should have professional footer message', () => {
      render(<DesktopRequired />)

      expect(screen.getByText(/Thank you for choosing EAV Orchestrator/)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(<DesktopRequired />)

      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1).toHaveTextContent('Desktop Required')

      const h2Elements = screen.getAllByRole('heading', { level: 2 })
      expect(h2Elements).toHaveLength(2)
      expect(h2Elements[0]).toHaveTextContent('Why Desktop?')
      expect(h2Elements[1]).toHaveTextContent('Access Options')
    })

    it('should have descriptive content for screen readers', () => {
      render(<DesktopRequired />)

      expect(screen.getByText(/Advanced paragraph-component editing with TipTap/)).toBeInTheDocument()
      expect(screen.getByText(/Script → Review → Scenes → Voice → Edit phases/)).toBeInTheDocument()
      expect(screen.getByText(/Google Docs-like review system/)).toBeInTheDocument()
    })
  })
})