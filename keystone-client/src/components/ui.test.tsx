import { fireEvent, render, screen } from "@testing-library/react";
import { Search } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Badge, Button, Card, Dialog, IconButton, SelectField, StatusRow, TextField, Tooltip } from "./ui";

describe("design system primitives", () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it.each(["keystone", "poison"] as const)("keeps semantic contracts and native behavior under the %s theme", (theme) => {
    const onActivate = vi.fn();
    document.documentElement.dataset.theme = theme;

    render(
      <div>
        <Card>Panel</Card>
        <Button onClick={onActivate} variant="primary">Guardar</Button>
        <Button disabled variant="danger">Eliminar</Button>
        <IconButton icon={<Search aria-hidden="true" size={16} />} label="Buscar rapido" />
        <Badge tone="success">Activo</Badge>
        <TextField label="Usuario" />
        <SelectField label="Idioma">
          <option value="es">Espanol</option>
        </SelectField>
        <dl>
          <StatusRow label="Estado" tone="warning" value="Pendiente" />
        </dl>
        <Dialog open title="Confirmar">
          <p>Contenido</p>
        </Dialog>
        <Tooltip label="Mas detalle">
          <span>?</span>
        </Tooltip>
      </div>,
    );

    const primary = screen.getByRole("button", { name: "Guardar" });
    const danger = screen.getByRole("button", { name: "Eliminar" });
    fireEvent.click(primary);

    expect(screen.getByText("Panel")).toHaveAttribute("data-ui", "card");
    expect(primary).toHaveAttribute("data-ui", "button");
    expect(primary).toHaveAttribute("data-variant", "primary");
    expect(onActivate).toHaveBeenCalledOnce();
    expect(danger).toHaveAttribute("data-variant", "danger");
    expect(danger).toBeDisabled();
    expect(screen.getByRole("button", { name: "Buscar rapido" })).toHaveAttribute("data-ui", "icon-button");
    expect(screen.getByText("Activo")).toHaveAttribute("data-tone", "success");
    expect(screen.getByLabelText("Usuario")).toHaveAttribute("data-ui", "text-field");
    expect(screen.getByLabelText("Idioma")).toHaveAttribute("data-ui", "select-field");
    expect(screen.getByText("Pendiente")).toHaveAttribute("data-tone", "warning");
    expect(screen.getByRole("dialog", { name: "Confirmar" })).toHaveAttribute("data-ui", "dialog");
    expect(screen.getByText("?").closest(".ui-tooltip")).toHaveAttribute("data-ui", "tooltip");
  });

  it("renders command controls with icons and accessible names", () => {
    render(
      <div>
        <Button icon={<Search aria-hidden="true" size={16} />}>Buscar</Button>
        <IconButton icon={<Search aria-hidden="true" size={16} />} label="Buscar rapido" />
      </div>,
    );

    expect(screen.getByRole("button", { name: "Buscar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buscar rapido" })).toHaveAttribute("title", "Buscar rapido");
  });

  it("renders fields, cards, badges, status rows, dialog, and tooltip", () => {
    render(
      <Card>
        <Badge tone="success">Activo</Badge>
        <TextField label="Usuario" />
        <SelectField label="Idioma">
          <option value="es">Espanol</option>
        </SelectField>
        <dl>
          <StatusRow label="Estado" tone="warning" value="Pendiente" />
        </dl>
        <Tooltip label="Mas detalle">
          <span>?</span>
        </Tooltip>
        <Dialog open title="Confirmar">
          <p>Contenido</p>
        </Dialog>
      </Card>,
    );

    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByLabelText("Usuario")).toBeInTheDocument();
    expect(screen.getByLabelText("Idioma")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Confirmar" })).toBeInTheDocument();
    expect(screen.getByText("?").closest(".ui-tooltip")).toHaveAttribute("data-tooltip", "Mas detalle");
  });
});
