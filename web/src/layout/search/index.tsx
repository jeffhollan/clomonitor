import classNames from 'classnames';
import { isEmpty, isUndefined } from 'lodash';
import { Dispatch, SetStateAction, useContext, useEffect, useState } from 'react';
import { FaFilter } from 'react-icons/fa';
import { IoMdCloseCircleOutline } from 'react-icons/io';
import { useNavigate, useSearchParams } from 'react-router-dom';

import API from '../../api';
import { AppContext, updateLimit, updateSort } from '../../context/AppContextProvider';
import useScrollRestorationFix from '../../hooks/useScrollRestorationFix';
import { Project, SearchFiltersURL, SortBy, SortDirection } from '../../types';
import buildSearchParams from '../../utils/buildSearchParams';
import prepareQueryString from '../../utils/prepareQueryString';
import Loading from '../common/Loading';
import NoData from '../common/NoData';
import Pagination from '../common/Pagination';
import PaginationLimit from '../common/PaginationLimit';
import SampleQueries from '../common/SampleQueries';
import Sidebar from '../common/Sidebar';
import SortOptions from '../common/SortOptions';
import SubNavbar from '../navigation/SubNavbar';
import Card from './Card';
import Filters from './filters';
import styles from './Search.module.css';
import SelectedFilters from './SelectedFilters';

interface FiltersProp {
  [key: string]: (string | number)[];
}

const prepareFilters = (filters: FiltersProp): FiltersProp => {
  let f: FiltersProp = { ...filters };
  Object.keys(filters).forEach((key: string) => {
    if (['maturity', 'category'].includes(key)) {
      f[key] = (f[key] as string[]).map((v: string) => parseInt(v));
    }
  });
  return f;
};

interface Props {
  scrollPosition?: number;
  setScrollPosition: Dispatch<SetStateAction<number | undefined>>;
}

interface AcceptedDate {
  accepted_from?: string;
  accepted_to?: string;
}

const Search = (props: Props) => {
  const navigate = useNavigate();
  const { ctx, dispatch } = useContext(AppContext);
  const { limit, sort } = ctx.prefs.search;
  const [searchParams] = useSearchParams();
  const [text, setText] = useState<string | undefined>();
  const [acceptedFrom, setAcceptedFrom] = useState<string | undefined>();
  const [acceptedTo, setAcceptedTo] = useState<string | undefined>();
  const [filters, setFilters] = useState<FiltersProp>({});
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [projects, setProjects] = useState<Project[] | null | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useScrollRestorationFix();

  const saveScrollPosition = () => {
    props.setScrollPosition(window.scrollY);
  };

  const updateWindowScrollPosition = (newPosition: number) => {
    window.scrollTo(0, newPosition);
  };

  const onResetFilters = (): void => {
    props.setScrollPosition(0);
    navigate({
      pathname: '/search',
      search: prepareQueryString({
        pageNumber: 1,
        text: text,
        filters: {},
      }),
    });
  };

  const calculateOffset = (pNumber: number): number => {
    return pNumber && limit ? (pNumber - 1) * limit : 0;
  };

  const getCurrentFilters = (): SearchFiltersURL => {
    return {
      pageNumber: pageNumber,
      text: text,
      accepted_from: acceptedFrom,
      accepted_to: acceptedTo,
      filters: filters,
    };
  };

  const onAcceptedDateRangeChange = (dates: AcceptedDate) => {
    props.setScrollPosition(0);
    navigate({
      pathname: '/search',
      search: prepareQueryString({
        ...getCurrentFilters(),
        accepted_from: dates.accepted_from,
        accepted_to: dates.accepted_to,
        pageNumber: 1,
      }),
    });
  };

  const updateCurrentPage = (searchChanges: any) => {
    props.setScrollPosition(0);
    navigate({
      pathname: '/search',
      search: prepareQueryString({
        ...getCurrentFilters(),
        pageNumber: 1,
        ...searchChanges,
      }),
    });
  };

  const onPageNumberChange = (pageNumber: number): void => {
    updateCurrentPage({
      pageNumber: pageNumber,
    });
  };

  const onFiltersChange = (name: string, value: string, checked: boolean): void => {
    const currentFilters = filters || {};
    let newFilters = isUndefined(currentFilters[name]) ? [] : currentFilters[name].slice();
    if (checked) {
      newFilters.push(value);
    } else {
      newFilters = newFilters.filter((el) => el !== value);
    }

    updateCurrentPage({
      filters: { ...currentFilters, [name]: newFilters },
    });
  };

  const onPaginationLimitChange = (newLimit: number): void => {
    props.setScrollPosition(0);
    navigate({
      pathname: '/search',
      search: prepareQueryString({
        ...getCurrentFilters(),
        pageNumber: 1,
      }),
    });
    dispatch(updateLimit(newLimit));
  };

  const onSortChange = (by: SortBy, direction: SortDirection): void => {
    props.setScrollPosition(0);
    // Load pageNumber is forced before update Sorting criteria
    navigate(
      {
        pathname: '/search',
        search: prepareQueryString({
          ...getCurrentFilters(),
          pageNumber: 1,
        }),
      },
      { replace: true }
    );
    dispatch(updateSort(by, direction));
  };

  useEffect(() => {
    const formattedParams = buildSearchParams(searchParams);
    setText(formattedParams.text);
    setAcceptedFrom(formattedParams.accepted_from);
    setAcceptedTo(formattedParams.accepted_to);
    setFilters(formattedParams.filters || {});

    setPageNumber(formattedParams.pageNumber);

    async function searchProjects() {
      setIsLoading(true);
      try {
        const newSearchResults = await API.searchProjects({
          text: formattedParams.text,
          accepted_from: formattedParams.accepted_from,
          accepted_to: formattedParams.accepted_to,
          sort_by: sort.by,
          sort_direction: sort.direction,
          filters: prepareFilters(formattedParams.filters || {}),
          offset: calculateOffset(formattedParams.pageNumber),
          limit: limit,
        });
        setTotal(parseInt(newSearchResults['Pagination-Total-Count']));
        setProjects(newSearchResults.items);
      } catch {
        // TODO - error
      } finally {
        setIsLoading(false);
        // Update scroll position
        updateWindowScrollPosition(props.scrollPosition || 0);
      }
    }
    searchProjects();
  }, [searchParams, limit, sort.by, sort.direction]); /* eslint-disable-line react-hooks/exhaustive-deps */

  return (
    <>
      <SubNavbar>
        <div className="d-flex flex-column w-100">
          <div className="d-flex flex-column flex-sm-row align-items-center justify-content-between flex-nowrap">
            <div className="d-flex flex-row flex-md-column align-items-center align-items-md-start w-100 text-truncate">
              <Sidebar
                label="Filters"
                className="d-inline-block d-md-none me-2"
                wrapperClassName="d-inline-block px-4"
                buttonType={`btn-primary btn-sm rounded-circle position-relative ${styles.btnMobileFilters}`}
                buttonIcon={<FaFilter />}
                closeButton={<>See {total} results</>}
                leftButton={
                  <>
                    {(!isEmpty(filters) || !isUndefined(acceptedFrom) || !isUndefined(acceptedTo)) && (
                      <div className="d-flex align-items-center">
                        <IoMdCloseCircleOutline className={`text-dark ${styles.resetBtnDecorator}`} />
                        <button
                          className="btn btn-link btn-sm p-0 ps-1 text-dark"
                          onClick={onResetFilters}
                          aria-label="Reset filters"
                        >
                          Reset
                        </button>
                      </div>
                    )}
                  </>
                }
                header={<div className="h6 text-uppercase mb-0 flex-grow-1">Filters</div>}
              >
                <div role="menu">
                  <Filters
                    device="mobile"
                    acceptedFrom={acceptedFrom}
                    acceptedTo={acceptedTo}
                    activeFilters={filters}
                    onChange={onFiltersChange}
                    onAcceptedDateRangeChange={onAcceptedDateRangeChange}
                    visibleTitle={false}
                  />
                </div>
              </Sidebar>
              <div className={`text-truncate fw-bold w-100 ${styles.searchResults}`} role="status">
                {total > 0 && (
                  <span className="pe-1">
                    {calculateOffset(pageNumber) + 1} - {total < limit * pageNumber ? total : limit * pageNumber}{' '}
                    <span className="ms-1">of</span>{' '}
                  </span>
                )}
                {total}
                <span className="ps-1"> results </span>
                {text && text !== '' && (
                  <span className="d-none d-sm-inline ps-1">
                    for "<span className="fw-bold">{text}</span>"
                  </span>
                )}
              </div>
            </div>
            <div className="d-flex flex-wrap flex-row justify-content-sm-end mt-3 mt-sm-0 ms-0 ms-md-3 w-100">
              <SortOptions by={sort.by} direction={sort.direction} onSortChange={onSortChange} />
              <PaginationLimit onPaginationLimitChange={onPaginationLimitChange} />
            </div>
          </div>

          <SelectedFilters
            acceptedFrom={acceptedFrom}
            acceptedTo={acceptedTo}
            filters={filters}
            onChange={onFiltersChange}
            onAcceptedDateRangeChange={onAcceptedDateRangeChange}
          />
        </div>
      </SubNavbar>

      <main role="main" className="container-lg flex-grow-1 mb-4 mb-md-5">
        {isLoading && <Loading position="fixed" transparentBg />}
        <div
          className={classNames('h-100 position-relative d-flex flex-row align-items-start', {
            'opacity-75': isLoading,
          })}
        >
          <aside
            className={`d-none d-md-block position-relative p-3 rounded-0 border mb-3 mb-lg-4 ${styles.sidebar}`}
            aria-label="Filters"
          >
            <Filters
              device="desktop"
              acceptedFrom={acceptedFrom}
              acceptedTo={acceptedTo}
              activeFilters={filters}
              onChange={onFiltersChange}
              onAcceptedDateRangeChange={onAcceptedDateRangeChange}
              onResetFilters={onResetFilters}
              visibleTitle
            />
          </aside>
          <div className={`d-flex flex-column flex-grow-1 mt-2 mt-md-3 ${styles.contentWrapper}`}>
            {projects && (
              <>
                {isEmpty(projects) ? (
                  <NoData>
                    <div className="h4">
                      We're sorry!
                      <p className="h6 mb-0 mt-3 lh-base">
                        <span> We can't seem to find any projects that match your search </span>
                        {text && (
                          <span className="ps-1">
                            for "<span className="fw-bold">{text}</span>"
                          </span>
                        )}
                        {!isEmpty(filters) ? <span className="ps-1">with the selected filters</span> : <>.</>}
                      </p>
                      <p className="h6 mb-0 mt-5 lh-base">
                        You can{' '}
                        {!isEmpty(filters) ? (
                          <button
                            className="btn btn-link text-dark fw-bold py-0 pb-1 px-0"
                            onClick={onResetFilters}
                            aria-label="Reset filters"
                          >
                            <u>reset the filters</u>
                          </button>
                        ) : (
                          <button
                            className="btn btn-link text-dark fw-bold py-0 pb-1 px-0"
                            onClick={() => {
                              props.setScrollPosition(0);
                              navigate({
                                pathname: '/search',
                                search: prepareQueryString({
                                  pageNumber: 1,
                                  filters: {},
                                }),
                              });
                            }}
                            aria-label="Browse all packages"
                          >
                            <u>browse all projects</u>
                          </button>
                        )}
                        <> or try a new search.</>
                      </p>
                      <div className="h5 d-flex flex-row align-items-end justify-content-center flex-wrap">
                        <SampleQueries className="bg-light text-dark border-secondary text-dark" />
                      </div>
                    </div>
                  </NoData>
                ) : (
                  <div className={`row g-4 g-xxl-0 ${styles.list}`} role="list">
                    {projects.map((item: Project) => (
                      <Card
                        project={item}
                        key={`card_${item.name}`}
                        currentQueryString={prepareQueryString(getCurrentFilters())}
                        saveScrollPosition={saveScrollPosition}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="mt-auto mx-auto">
              <Pagination
                limit={limit}
                offset={0}
                total={total}
                active={pageNumber}
                className="mt-4 mt-md-5 mb-0 mb-md-2"
                onChange={onPageNumberChange}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default Search;
