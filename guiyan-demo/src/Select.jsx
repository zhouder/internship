import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

const labelText = (node) =>
  Children.toArray(node)
    .map((n) => (isValidElement(n) ? labelText(n.props.children) : String(n)))
    .join("");
function readOptions(children, inheritedDisabled = false) {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    if (child.type === "option")
      return [
        {
          value: String(child.props.value ?? labelText(child.props.children)),
          label: labelText(child.props.children),
          disabled: inheritedDisabled || !!child.props.disabled,
        },
      ];
    if (child.type === Fragment || child.type === "optgroup")
      return readOptions(
        child.props.children,
        inheritedDisabled || !!child.props.disabled,
      );
    return [];
  });
}

// Keep the existing controlled-select API and native form validation, while
// rendering the popup ourselves so its layout never depends on OS menus.
export function Select({
  children,
  value,
  defaultValue,
  onChange,
  name,
  required,
  disabled,
  className = "",
  id,
  ...props
}) {
  const options = readOptions(children),
    generated = useId(),
    listId = generated + "-list";
  const [internal, setInternal] = useState(() =>
      String(defaultValue ?? options[0]?.value ?? ""),
    ),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    [position, setPosition] = useState({}),
    [invalid, setInvalid] = useState(false);
  const selected = String(value ?? internal),
    selectedIndex = options.findIndex((o) => o.value === selected),
    current = options[selectedIndex];
  const button = useRef(null),
    popup = useRef(null),
    native = useRef(null),
    search = useRef({ text: "", time: 0 });
  const enabled = options
    .map((o, i) => (o.disabled ? -1 : i))
    .filter((i) => i >= 0);
  function show() {
    if (disabled || !enabled.length) return;
    setActive(enabled.includes(selectedIndex) ? selectedIndex : enabled[0]);
    setOpen(true);
  }
  function choose(index) {
    const option = options[index];
    if (!option || option.disabled) return;
    setInternal(option.value);
    setInvalid(false);
    setOpen(false);
    if (option.value !== selected)
      onChange?.({
        target: { value: option.value, name },
        currentTarget: { value: option.value, name },
        type: "change",
      });
    button.current?.focus({ preventScroll: true });
  }
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = button.current?.getBoundingClientRect();
      if (!r) return;
      if (r.bottom < 0 || r.top > innerHeight) {
        setOpen(false);
        return;
      }
      const height = Math.min(312, Math.max(56, options.length * 42 + 12)),
        below = innerHeight - r.bottom - 12,
        above = r.top - 12,
        up = below < height && above > below,
        maxHeight = Math.max(40, Math.min(height, up ? above : below)),
        width = Math.min(Math.max(r.width, 184), innerWidth - 24);
      setPosition({
        position: "fixed",
        left: Math.max(12, Math.min(r.left, innerWidth - width - 12)),
        top: up ? Math.max(12, r.top - maxHeight - 6) : r.bottom + 6,
        width,
        maxHeight,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, options.length]);
  useEffect(() => {
    if (!open) return;
    const outside = (e) => {
      if (
        !button.current?.contains(e.target) &&
        !popup.current?.contains(e.target)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const menu = popup.current,
      option = menu?.querySelector('[data-active="true"]');
    if (!menu || !option) return;
    const top = option.offsetTop,
      bottom = top + option.offsetHeight;
    if (top < menu.scrollTop) menu.scrollTop = top;
    else if (bottom > menu.scrollTop + menu.clientHeight)
      menu.scrollTop = bottom - menu.clientHeight;
  }, [open, active]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  function keydown(e) {
    if (
      ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape"].includes(
        e.key,
      )
    ) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        if (open) choose(active);
        else show();
        return;
      }
      if (!open) {
        show();
        return;
      }
      let index = enabled.indexOf(active);
      setActive(
        e.key === "Home"
          ? enabled[0]
          : e.key === "End"
            ? enabled.at(-1)
            : enabled[
                (index + (e.key === "ArrowDown" ? 1 : -1) + enabled.length) %
                  enabled.length
              ],
      );
      return;
    }
    if (e.key === "Tab") {
      setOpen(false);
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      search.current = {
        text:
          (now - search.current.time < 700 ? search.current.text : "") +
          e.key.toLowerCase(),
        time: now,
      };
      const match = options.findIndex(
        (o) =>
          !o.disabled && o.label.toLowerCase().startsWith(search.current.text),
      );
      if (match >= 0) {
        if (!open) show();
        setActive(match);
      }
      e.preventDefault();
    }
  }
  return (
    <div className={"smart-select " + className}>
      <button
        {...props}
        id={id}
        ref={button}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? listId + "-" + active : undefined}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        className="smart-select-trigger"
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={keydown}
      >
        <span className="smart-select-value">{current?.label || "请选择"}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={open ? "select-chevron open" : "select-chevron"}
        />
      </button>
      <select
        ref={native}
        className="smart-select-validation"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        required={required}
        disabled={disabled}
        value={selected}
        onChange={(e) =>
          choose(options.findIndex((o) => o.value === e.target.value))
        }
        onInvalid={(e) => {
          e.preventDefault();
          setInvalid(true);
          button.current?.focus();
          show();
        }}
      >
        {options.map((o, i) => (
          <option key={i} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      {open
        ? createPortal(
            <div
              ref={popup}
              id={listId}
              role="listbox"
              aria-label={props["aria-label"] || "选项"}
              className="smart-select-menu"
              style={position}
            >
              {options.map((o, i) => (
                <div
                  id={listId + "-" + i}
                  role="option"
                  key={i}
                  aria-selected={o.value === selected}
                  aria-disabled={o.disabled || undefined}
                  data-active={i === active}
                  className="smart-select-option"
                  onPointerMove={() => !o.disabled && setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(i)}
                >
                  <span>{o.label}</span>
                  {o.value === selected ? (
                    <Check size={16} aria-hidden="true" />
                  ) : null}
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
