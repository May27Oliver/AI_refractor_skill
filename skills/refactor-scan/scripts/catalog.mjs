const rows = `
001|Long Method|過長函式|smell|heuristic
002|Duplicated Code|重複程式碼|smell|heuristic
003|Unclear Naming|意義不明的命名|smell|heuristic
004|Deep Nesting|過深的巢狀結構|smell|heuristic
005|Magic Number|魔術數字|smell|heuristic
006|Large Class|巨型類別|smell|heuristic
007|Long Parameter List|過長的參數列表|smell|heuristic
008|Dead Code|死亡程式碼|smell|heuristic
009|Shotgun Surgery|修改分散|smell|manual
010|Divergent Change|發散式變更|smell|manual
011|Spaghetti Code|義大利麵式程式碼|smell|manual
012|Global Variables|全域變數|smell|heuristic
013|Feature Envy|特性依戀|smell|manual
014|Data Clumps|資料泥團|smell|manual
015|Primitive Obsession|基本資料型別偏執|smell|manual
016|Switch Statements|Switch 敘述氾濫|smell|heuristic
017|Temporary Field|暫時性欄位|smell|manual
018|Message Chains|訊息鏈|smell|heuristic
019|Middle Man|中間人|smell|manual
020|Speculative Generality|推測性泛化|smell|manual
021|Lazy Class|懶惰類別|smell|manual
022|Data Class|資料類別|smell|manual
023|Parallel Inheritance Hierarchies|平行繼承階層|smell|manual
024|Refused Bequest|拒絕繼承的遺產|smell|manual
025|Inappropriate Intimacy|不適當的親密關係|smell|manual
026|Extract Function|提取函式|technique|contextual
027|Rename Variable|變數重新命名|technique|contextual
028|Change Function Declaration|修改函式宣告|technique|contextual
029|Extract Variable|提取變數|technique|contextual
030|Extract Class|提取類別|technique|contextual
031|Inline Function|內聯函式|technique|contextual
032|Split Variable|拆分變數|technique|contextual
033|Introduce Parameter Object|引入參數物件|technique|contextual
034|Remove Flag Argument|移除旗標參數|technique|contextual
035|Separate Query from Modifier|分離查詢與修改|technique|contextual
036|Move Function|搬移函式|technique|contextual
037|Split Phase|分離階段|technique|contextual
038|Combine Functions into Class|將函式組合成類別|technique|contextual
039|Inline Variable|內聯變數|technique|contextual
040|Substitute Algorithm|替換演算法|technique|contextual
041|Slide Statements|滑動敘述|technique|contextual
042|Parameterize Function|將函式參數化|technique|contextual
043|Hide Delegate|隱藏委派關係|technique|contextual
044|Remove Middle Man|移除中間人|technique|contextual
045|Inline Class|內聯類別|technique|contextual
046|Extract Factory Function|提取工廠函式|technique|contextual
047|Encapsulate Variable|封裝變數|technique|contextual
048|Pull Up Method|提升方法|technique|contextual
049|Extract Superclass|提取父類別|technique|contextual
050|Collapse Hierarchy|扁平化繼承階層|technique|contextual
051|Guard Clause|衛述句|technique|contextual
052|Decompose Conditional|分解條件運算式|technique|contextual
053|Consolidate Conditional Expression|合併條件運算式|technique|contextual
054|Replace Conditional with Polymorphism|以多型取代條件判斷|technique|contextual
055|Split Loop|拆分迴圈|technique|contextual
056|Introduce Special Case|引入特殊案例|technique|contextual
057|Introduce Assertion|引入斷言|technique|contextual
058|Remove Control Flag|移除控制旗標|technique|contextual
059|Replace Loop with Pipeline|以管線取代迴圈|technique|contextual
060|Replace Conditional with Lookup Table|以查詢表取代條件判斷|technique|contextual
061|Strategy Pattern|策略模式|technique|contextual
062|Fail Fast|快速失敗|technique|contextual
063|Ternary Operator|三元運算子|technique|contextual
064|De Morgan's Laws|德摩根定律|technique|contextual
065|Optional Chaining|可選串連|technique|contextual
066|Nullish Coalescing|空值合併運算子|technique|contextual
067|Enum|列舉型別|technique|contextual
068|State Pattern|狀態模式|technique|contextual
069|Pattern Matching|模式匹配|technique|contextual
070|Short-Circuit Evaluation|短路求值|technique|contextual
071|Exception Swallowing|避免吞掉例外|technique|heuristic
072|Loop-Invariant Code Motion|將迴圈不變程式碼外移|technique|contextual
073|State Machine|狀態機|technique|contextual
074|Decision Table|決策表|technique|contextual
075|Yoda Conditions|尤達條件式|technique|contextual
076|Characterization Test|特徵測試|guardrail|contextual
077|Small Steps|小步驟重構|guardrail|contextual
078|Regression Test|回歸測試|guardrail|contextual
079|Single Responsibility Principle|單一職責原則|principle|contextual
080|Don't Repeat Yourself|DRY 原則|principle|contextual
081|Keep It Simple|KISS 原則|principle|contextual
082|You Aren't Gonna Need It|YAGNI 原則|principle|contextual
083|Separation of Concerns|關注點分離|principle|contextual
084|Boy Scout Rule|童子軍法則|principle|contextual
085|Unit Test|單元測試|guardrail|contextual
086|Linter|靜態程式碼檢查|guardrail|contextual
087|Formatter|程式碼格式化|guardrail|contextual
088|Cyclomatic Complexity|循環複雜度|metric|heuristic
089|Cognitive Complexity|認知複雜度|metric|heuristic
090|Code Coverage|程式碼覆蓋率|metric|external
091|Type Annotations|型別註記|technique|contextual
092|Law of Demeter|迪米特法則|principle|contextual
093|Dependency Injection|依賴注入|technique|contextual
094|Pure Function|純函式|principle|contextual
095|Immutability|不可變性|principle|contextual
096|Strangler Fig Pattern|絞殺者無花果模式|technique|contextual
097|Naming Conventions|命名規範|principle|contextual
098|Mikado Method|三笠法|technique|contextual
099|Golden Master Testing|黃金主檔測試|guardrail|contextual
100|Open-Closed Principle|開放封閉原則|principle|contextual
`;

const intents = [
  "Identify functions whose size hides distinct responsibilities or stages.",
  "Identify repeated knowledge or logic that can drift when changed separately.",
  "Identify names that do not communicate the represented concept or purpose.",
  "Identify nested control flow that makes paths difficult to follow.",
  "Identify unexplained literals whose business or technical meaning is hidden.",
  "Identify classes that combine multiple substantial responsibilities.",
  "Identify declarations whose parameter count makes calls fragile or unclear.",
  "Identify code with no confirmed static, dynamic, framework, or external use.",
  "Identify changes that repeatedly require coordinated edits across many files.",
  "Identify modules that change frequently for unrelated reasons.",
  "Identify tangled execution flow whose ordering and state are hard to follow.",
  "Identify mutable shared state accessible across broad boundaries.",
  "Identify behavior that depends more on another owner’s data than its own.",
  "Identify values that repeatedly travel together without a named concept.",
  "Identify domain concepts represented only by weak primitives.",
  "Identify repeated type or state branching across multiple locations.",
  "Identify fields meaningful only during a narrow lifecycle or mode.",
  "Identify long navigation chains that expose internal object structure.",
  "Identify abstractions that only forward calls without protecting a boundary.",
  "Identify unused extension points created for hypothetical future needs.",
  "Identify classes whose cost and indirection exceed their current value.",
  "Identify passive data holders that may be missing closely related behavior.",
  "Identify inheritance families that must grow in lockstep.",
  "Identify subtypes forced to inherit behavior they cannot meaningfully support.",
  "Identify modules coupled through knowledge of each other’s internals.",
  "Extract a named function when a coherent block has a clear contract.",
  "Rename a variable so its concept and role are apparent at the use site.",
  "Change a function name or parameters to match its actual contract.",
  "Name a complex expression when the name clarifies its meaning.",
  "Extract a class when a cohesive responsibility has a stable boundary.",
  "Inline a function whose indirection adds no useful meaning or boundary.",
  "Split a variable that represents multiple values or phases over time.",
  "Introduce a parameter object for a stable group of related inputs.",
  "Replace a boolean mode flag with intention-revealing operations.",
  "Separate observation from mutation when callers need independent control.",
  "Move behavior toward the data and invariants it primarily owns.",
  "Separate processing stages that have distinct inputs, outputs, or reasons to change.",
  "Group functions around shared data only when the resulting owner is cohesive.",
  "Inline a variable that merely repeats an already clear expression.",
  "Replace an unnecessarily complex algorithm with an equivalent clearer one.",
  "Move related statements together without changing execution semantics.",
  "Parameterize operations that differ only by a meaningful value.",
  "Hide delegation when exposing the delegate leaks an unstable structure.",
  "Remove a forwarding layer when callers can safely use the real boundary.",
  "Inline a class whose separate identity no longer carries useful meaning.",
  "Centralize object construction when creation has policy or multiple steps.",
  "Control access to shared state through an explicit boundary.",
  "Pull duplicated subtype behavior into a valid shared parent contract.",
  "Extract a superclass only when multiple types share a genuine substitutable concept.",
  "Collapse parent and child types when their distinction has no useful contract.",
  "Handle exceptional or invalid cases early to flatten the main path.",
  "Name complex condition parts so the business decision becomes readable.",
  "Combine conditions only when they produce exactly the same outcome and effects.",
  "Replace repeated type branching with polymorphism when variation is stable and distributed.",
  "Split a loop when it performs independent jobs and the extra pass is acceptable.",
  "Represent a recurring exceptional value with one coherent special case.",
  "State an invariant as an assertion when violation indicates a programming error.",
  "Replace loop control flags with structured return, break, or continue flow.",
  "Use a collection pipeline only when it is clearer and preserves cost and ordering.",
  "Replace stable value-to-result branching with an explicit lookup table.",
  "Encapsulate interchangeable algorithms behind a small strategy contract.",
  "Reject invalid input at the earliest boundary that has enough context.",
  "Use a ternary only for a short, symmetric, easily scanned expression.",
  "Apply De Morgan’s laws when the transformed condition is easier to verify.",
  "Use optional chaining when missing intermediate values share nullish semantics.",
  "Use nullish coalescing when only null or undefined should trigger a default.",
  "Represent a closed value set with the project’s preferred typed construct.",
  "Encapsulate state-dependent behavior when states and transitions are stable.",
  "Use pattern matching when the language and project support exhaustive shape handling.",
  "Use short-circuit evaluation when it makes the guard and skipped work explicit.",
  "Identify catches that discard failures without a deliberate handling policy.",
  "Move loop-invariant work outside a loop when semantics and timing remain unchanged.",
  "Model explicit states and legal transitions when flags permit invalid combinations.",
  "Use a decision table to enumerate multi-condition outcomes and missing combinations.",
  "Treat Yoda conditions as a team-style choice rather than a default refactoring.",
  "Capture current observable behavior before changing poorly specified legacy code.",
  "Perform one reversible structural change at a time and inspect its diff.",
  "Run relevant regression checks to show existing behavior remains intact.",
  "Separate responsibilities by independent reasons to change, not by arbitrary size.",
  "Centralize duplicated knowledge while tolerating coincidental code similarity.",
  "Prefer the simplest design that clearly preserves the required behavior.",
  "Avoid extension points and abstractions unsupported by a current requirement.",
  "Keep presentation, business policy, and infrastructure concerns at useful boundaries.",
  "Improve nearby code only within the authorized and reviewable task scope.",
  "Protect extracted behavior with focused tests that assert meaningful outcomes.",
  "Use the repository’s linter as evidence; do not fix unrelated warnings by default.",
  "Use the repository’s formatter without creating unrelated formatting churn.",
  "Use branch-path complexity as a prioritization signal, not a quality verdict.",
  "Use nesting-weighted reading difficulty as a prioritization signal.",
  "Use coverage to locate unprotected behavior, then inspect assertion quality.",
  "Add type annotations where they clarify a boundary or prevent unsafe inference.",
  "Reduce knowledge of collaborator internals and long navigation paths.",
  "Inject dependencies when substitution or lifecycle control justifies the seam.",
  "Isolate deterministic computation from side effects where the boundary stays clear.",
  "Prefer value replacement over mutation when identity and performance permit it.",
  "Replace legacy behavior incrementally behind a controlled migration boundary.",
  "Follow established naming conventions before proposing repository-wide changes.",
  "Map prerequisite changes for a large refactor and complete leaves in small steps.",
  "Compare representative outputs before and after when precise assertions are impractical.",
  "Design extension seams only around demonstrated variation, without speculative generality.",
];

const relatedById = {
  "001": ["026", "037", "051", "076"],
  "002": ["026", "036", "042", "080"],
  "003": ["027", "028", "097"],
  "004": ["026", "051", "052", "089"],
  "005": ["029", "067", "097"],
  "006": ["030", "036", "079", "083"],
  "007": ["028", "033", "034"],
  "008": ["031", "045", "082"],
  "009": ["036", "047", "080", "098"],
  "010": ["030", "037", "079", "083"],
  "011": ["037", "051", "073", "076"],
  "012": ["047", "093", "095"],
  "013": ["036", "079"],
  "014": ["033", "038"],
  "015": ["033", "067", "094"],
  "016": ["054", "060", "061", "074"],
  "017": ["030", "056", "068"],
  "018": ["043", "092"],
  "019": ["044", "045"],
  "020": ["031", "045", "082"],
  "021": ["044", "045"],
  "022": ["036", "038", "094"],
  "023": ["036", "050"],
  "024": ["050", "054"],
  "025": ["036", "043", "092"],
  "071": ["062", "078", "085"],
  "088": ["026", "051", "052", "055"],
  "089": ["026", "037", "051", "052"],
};

export const cases = rows.trim().split("\n").map((row, index) => {
  const [id, title, titleZh, kind, scanMode] = row.split("|");
  return { id, title, titleZh, kind, scanMode, intent: intents[index], related: relatedById[id] ?? [] };
});

export const caseById = new Map(cases.map((item) => [item.id, item]));

export const packs = {
  complexity: ["001", "004", "006", "007", "088", "089"],
  duplication: ["002", "009", "010", "080"],
  naming: ["003", "005", "097"],
  data: ["012", "014", "015", "017", "022"],
  coupling: ["013", "018", "019", "025", "092"],
  abstraction: ["016", "020", "021", "023", "024"],
  safety: ["008", "071", "076", "078", "085", "090"],
};

export function selectCases(ids) {
  return ids.map((rawId) => {
    const id = String(rawId).padStart(3, "0");
    const item = caseById.get(id);
    if (!item) throw new Error(`Unknown case ID: ${rawId}`);
    return item;
  });
}
