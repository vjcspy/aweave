# Code Review Patterns

Common patterns to flag during code reviews with examples.

## Security Patterns

### SQL Injection

```javascript
// 🔴 BAD: SQL injection vulnerability
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ GOOD: Parameterized query
const query = 'SELECT * FROM users WHERE id = $1';
await db.query(query, [userId]);
```

### XSS Prevention

```javascript
// 🔴 BAD: XSS vulnerability
element.innerHTML = userInput;

// ✅ GOOD: Sanitize or use textContent
element.textContent = userInput;
// Or use DOMPurify
element.innerHTML = DOMPurify.sanitize(userInput);
```

### Hardcoded Secrets

```javascript
// 🔴 BAD: Hardcoded API key
const apiKey = 'sk-1234567890abcdef';

// ✅ GOOD: Environment variable
const apiKey = process.env.API_KEY;
```

### Path Traversal

```javascript
// 🔴 BAD: Path traversal vulnerability
const file = path.join(uploadDir, userFilename);

// ✅ GOOD: Validate path is within allowed directory
const safePath = path.join(uploadDir, path.basename(userFilename));
if (!safePath.startsWith(uploadDir)) {
  throw new Error('Invalid path');
}
```

## Performance Patterns

### N+1 Query

```javascript
// 🔴 BAD: N+1 query
for (const user of users) {
  const posts = await getPosts(user.id);  // Query per user
}

// ✅ GOOD: Batch query
const userIds = users.map(u => u.id);
const posts = await getPostsByUserIds(userIds);
```

### Missing Database Index

```sql
-- 🔴 BAD: Query on non-indexed column (assuming no index)
SELECT * FROM orders WHERE customer_email = 'user@example.com';

-- ✅ GOOD: Add index for frequently queried columns
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
```

### Memory Leak - Event Listeners

```javascript
// 🔴 BAD: Memory leak - listener not removed
useEffect(() => {
  window.addEventListener('resize', handleResize);
}, []);

// ✅ GOOD: Cleanup on unmount
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

### Blocking in Async Context

```javascript
// 🔴 BAD: Blocking sync read in async context
app.get('/data', async (req, res) => {
  const data = fs.readFileSync('large-file.json');  // Blocks event loop
  res.json(data);
});

// ✅ GOOD: Use async version
app.get('/data', async (req, res) => {
  const data = await fs.promises.readFile('large-file.json');
  res.json(JSON.parse(data));
});
```

### Unnecessary Re-renders (React)

```javascript
// 🔴 BAD: New object reference on each render
<Component style={{ color: 'red' }} />

// ✅ GOOD: Memoize or define outside
const styles = { color: 'red' };
<Component style={styles} />

// Or use useMemo for dynamic styles
const styles = useMemo(() => ({ color: theme.primary }), [theme.primary]);
```

## Code Quality Patterns

### Error Handling

```javascript
// 🔴 BAD: Swallowing errors
try {
  await riskyOperation();
} catch (e) {
  // Silent fail
}

// ✅ GOOD: Handle or propagate with context
try {
  await riskyOperation();
} catch (e) {
  logger.error('Operation failed', { error: e, context: { userId } });
  throw new AppError('Operation failed', { cause: e });
}
```

### Magic Numbers

```javascript
// 🔴 BAD: Magic numbers
if (retries > 3) { ... }
setTimeout(fn, 86400000);

// ✅ GOOD: Named constants
const MAX_RETRIES = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

if (retries > MAX_RETRIES) { ... }
setTimeout(fn, ONE_DAY_MS);
```

### Deep Nesting

```javascript
// 🔴 BAD: Deep nesting
function processData(data) {
  if (data) {
    if (data.users) {
      for (const user of data.users) {
        if (user.active) {
          if (user.email) {
            // actual logic here
          }
        }
      }
    }
  }
}

// ✅ GOOD: Early returns and guard clauses
function processData(data) {
  if (!data?.users) return;
  
  const activeUsersWithEmail = data.users.filter(
    user => user.active && user.email
  );
  
  for (const user of activeUsersWithEmail) {
    // actual logic here
  }
}
```

### Function Doing Too Much

```javascript
// 🔴 BAD: Function doing multiple things
async function handleUserRegistration(userData) {
  // Validate
  if (!userData.email) throw new Error('Email required');
  // Hash password
  const hash = await bcrypt.hash(userData.password, 10);
  // Save to DB
  const user = await db.users.create({ ...userData, password: hash });
  // Send email
  await sendWelcomeEmail(user.email);
  // Create audit log
  await createAuditLog('user_created', user.id);
  return user;
}

// ✅ GOOD: Split into focused functions
async function handleUserRegistration(userData) {
  validateUserData(userData);
  const user = await createUser(userData);
  await Promise.all([
    sendWelcomeEmail(user.email),
    createAuditLog('user_created', user.id)
  ]);
  return user;
}
```

## Testing Patterns

### Testing Implementation vs Behavior

```javascript
// 🔴 BAD: Testing implementation details
test('calls setState with correct value', () => {
  const setStateSpy = jest.spyOn(component, 'setState');
  component.handleClick();
  expect(setStateSpy).toHaveBeenCalledWith({ count: 1 });
});

// ✅ GOOD: Testing behavior
test('increments counter when clicked', () => {
  render(<Counter />);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

### Flaky Test - Time Dependent

```javascript
// 🔴 BAD: Time-dependent test
test('token expires', async () => {
  const token = createToken();
  await new Promise(r => setTimeout(r, 1000));  // Flaky!
  expect(token.isExpired()).toBe(true);
});

// ✅ GOOD: Control time
test('token expires', () => {
  jest.useFakeTimers();
  const token = createToken();
  jest.advanceTimersByTime(TOKEN_EXPIRY_MS);
  expect(token.isExpired()).toBe(true);
});
```

## API Design Patterns

### Inconsistent Error Format

```javascript
// 🔴 BAD: Inconsistent error responses
res.status(400).json({ error: 'Invalid email' });
res.status(404).json({ message: 'Not found' });
res.status(500).send('Server error');

// ✅ GOOD: Consistent error format
res.status(400).json({
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid email format',
    details: [{ field: 'email', issue: 'Must be valid email' }]
  }
});
```

### Missing Pagination

```javascript
// 🔴 BAD: Returns all records
app.get('/users', async (req, res) => {
  const users = await db.users.findAll();  // Could be millions!
  res.json(users);
});

// ✅ GOOD: Paginated response
app.get('/users', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  const [users, total] = await Promise.all([
    db.users.findAll({ limit, offset }),
    db.users.count()
  ]);
  
  res.json({
    data: users,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
});
```

## Logging Patterns

### Logging Sensitive Data

```javascript
// 🔴 BAD: Logging sensitive data
logger.info('User login', { email, password, creditCard });

// ✅ GOOD: Redact sensitive fields
logger.info('User login', { 
  email, 
  password: '[REDACTED]',
  creditCard: creditCard.slice(-4).padStart(16, '*')
});
```

### Missing Context

```javascript
// 🔴 BAD: Log without context
logger.error('Request failed');

// ✅ GOOD: Include relevant context
logger.error('Request failed', {
  requestId: req.id,
  userId: req.user?.id,
  endpoint: req.path,
  error: err.message,
  stack: err.stack
});
```
