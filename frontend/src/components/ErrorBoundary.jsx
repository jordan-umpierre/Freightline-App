import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="loading-screen">
          <p>
            Something went wrong.{' '}
            <button onClick={() => window.location.reload()}>Reload</button>
          </p>
        </main>
      )
    }

    return this.props.children
  }
}
