type ExampleProps = {
  label: string;
};

export function Example({ label }: ExampleProps) {
  return (
    <div className="example" data-testid="migration-example">
      <span className="example__dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
