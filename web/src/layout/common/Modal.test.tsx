import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Modal from './Modal';

const onCloseMock = jest.fn();
const cleanErrorMock = jest.fn();

const defaultProps = {
  header: 'title',
  children: <span>children</span>,
  onClose: onCloseMock,
  cleanError: cleanErrorMock,
  open: true,
};

describe('Modal', () => {
  it('creates snapshot', () => {
    const { asFragment } = render(<Modal {...defaultProps} />);
    expect(asFragment()).toMatchSnapshot();
  });

  it('renders proper content', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Close modal' })).toBeInTheDocument();
    expect(screen.getByText('children')).toBeInTheDocument();
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByTestId('modalBackdrop')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('calls onClose to click close button', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toHaveClass('d-block');

    userEvent.click(screen.getByRole('button', { name: 'Close modal' }));
    expect(onCloseMock).toHaveBeenCalledTimes(1);

    expect(screen.getByRole('dialog')).not.toHaveClass('d-block');
  });

  it('calls onClose to click close button on modal footer', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toHaveClass('d-block');

    userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.getByRole('dialog')).not.toHaveClass('d-block');
  });

  it('opens Modal to click Open Modal btn', async () => {
    render(<Modal {...defaultProps} buttonContent="Open modal" open={false} />);

    const modal = screen.getByRole('dialog');
    expect(modal).not.toHaveClass('active d-block');
    const btn = screen.getByRole('button', { name: /Open modal/ });

    userEvent.click(btn);

    expect(await screen.findByRole('dialog')).toHaveClass('active d-block');
  });
});
