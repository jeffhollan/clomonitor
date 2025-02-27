import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter as Router } from 'react-router-dom';

import Navbar from './Navbar';

const mockSetScrollPosition = jest.fn();

const defaultProps = {
  setScrollPosition: mockSetScrollPosition,
};

describe('Navbar', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates snapshot', () => {
    const { asFragment } = render(
      <Router>
        <Navbar {...defaultProps} />
      </Router>
    );
    expect(asFragment()).toMatchSnapshot();
  });

  it('renders proper content', () => {
    render(
      <Router>
        <Navbar {...defaultProps} />
      </Router>
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByAltText('CLOMonitor logo')).toBeInTheDocument();

    const links = screen.getAllByRole('link');
    expect(links[0]).toBeInTheDocument();
    expect(links[0]).toHaveAttribute('href', '/');

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('clicks logo', () => {
    render(
      <Router>
        <Navbar {...defaultProps} />
      </Router>
    );

    const links = screen.getAllByRole('link');
    userEvent.click(links[0]);

    expect(mockSetScrollPosition).toHaveBeenCalledTimes(1);
    expect(mockSetScrollPosition).toHaveBeenCalledWith(0);

    expect(window.location.pathname).toBe('/');
  });
});
